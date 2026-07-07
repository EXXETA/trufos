import undici, { Agent, Dispatcher, FormData } from 'undici';
import { getDurationFromNow, getSteadyTimestamp } from 'main/util/time-util';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable } from 'stream';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { GraphQLBody, RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { buildUrl } from 'shim/objects/url';
import { TrufosResponse } from 'shim/objects/response';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { TrufosHeader } from 'shim/objects/headers';
import { calculateResponseSize } from 'main/util/size-calculation';
import { app } from 'electron';
import process from 'node:process';
import { ResponseBodyService } from 'main/network/service/response-body-service';
import { ScriptingService } from 'main/scripting/scripting-service';
import { ScriptType } from 'shim/scripting';
import { text, buffer } from 'node:stream/consumers';

const fileSystemService = FileSystemService.instance;
const environmentService = EnvironmentService.instance;
const persistenceService = PersistenceService.instance;
const responseBodyService = ResponseBodyService.instance;
const scriptingService = ScriptingService.instance;

declare type HttpHeaders = Record<string, string[]>;
declare type DispatcherProvider = () => Promise<Dispatcher>;

/**
 * Singleton service for making HTTP requests
 */
export class HttpService {
  public static readonly instance = new HttpService();

  private readonly _dispatcherProvider: DispatcherProvider;

  constructor(dispatcherProvider?: DispatcherProvider) {
    this._dispatcherProvider = dispatcherProvider ?? this.buildDefaultDispatcher.bind(this);
  }

  private async buildDefaultDispatcher(): Promise<Dispatcher> {
    const cert = environmentService.currentCollection.clientCertificate;
    if (cert == null) {
      return new Agent({ connect: { rejectUnauthorized: false } }); // allow self-signed certificates
    }
    return new Agent({
      connect: {
        rejectUnauthorized: false,
        cert: await fsp.readFile(cert.certPath),
        key: cert.keyPath ? await fsp.readFile(cert.keyPath) : undefined,
        ca: cert.caPath ? await fsp.readFile(cert.caPath) : undefined,
      },
    });
  }

  /**
   * Fetch a resource asynchronously. The response body is written to a temporary file.
   * @param request request object
   * @returns response object
   */
  public async fetchAsync(request: TrufosRequest) {
    logger.info('Sending request:', request);

    // resolve variables (except in body, which is resolved stream-based during send)
    const url = await environmentService.setVariablesInString(buildUrl(request.url));

    // set authorization header if the request has authentication information
    let authorization: string | undefined;
    if (request.auth != null) {
      try {
        logger.debug('Generating authentication header');
        authorization = await environmentService.getAuthorizationHeader(request.auth, {
          method: request.method,
          url,
        });
      } catch (e) {
        logger.error('Failed to generate authentication header:', e);
        throw new Error('Please check your authentication settings and try again', { cause: e });
      }
    }

    const headers = await this.resolveVariablesInHeaders(
      this.trufosHeadersToUndiciHeaders(request.headers)
    );

    // execute pre-request script if it exists
    await this.executeScript(request, ScriptType.PRE_REQUEST);

    const [body, size, requestUrl] = await this.readBody(request, url);

    // measure duration of the request
    const now = getSteadyTimestamp();
    const responseData = await undici.request(requestUrl ?? url, {
      dispatcher: await this._dispatcherProvider(),
      method: request.method,
      headers: {
        ['content-type']: this.getContentType(request.body),
        ['authorization']: authorization,
        ['content-length']: size?.toString(),
        ['user-agent']: `Trufos/${app.getVersion()} (${process.platform} ${process.getSystemVersion()}; ${process.arch})`,
        ...headers,
      },
      body,
    });

    const duration = getDurationFromNow(now);
    logger.info(`Received response in ${duration}ms`);

    // execute post-response script if it exists
    await this.executeScript(request, ScriptType.POST_RESPONSE);

    // write the response body to a temporary file
    const bodyFile = fileSystemService.temporaryFile();
    if (responseData.body != null) {
      logger.debug('Writing response body to temporary file:', bodyFile.name);
      await pipeline(responseData.body, fs.createWriteStream('', { fd: bodyFile.fd }));
      logger.debug('Successfully written response body');
    }

    const graphqlErrors = await this.countGraphQLErrors(request, bodyFile.name);

    // return a new Response instance
    const response: TrufosResponse = {
      type: 'response',
      metaInfo: {
        status: responseData.statusCode,
        duration: duration,
        size: calculateResponseSize(
          responseData.headers,
          responseData.body != null ? (bodyFile.name ?? undefined) : undefined
        ),
        graphqlErrors,
      },
      headers: Object.freeze(responseData.headers),
      id: (responseData.body != null
        ? responseBodyService.register(bodyFile.name!, responseData.headers)
        : undefined) as string,
    };

    logger.debug('Returning response:', response);
    return response;
  }

  /**
   * Read the request body from the file system
   * @param request request object
   * @returns request body as stream or null if there is no body
   */
  private async readBody(
    request: TrufosRequest,
    url: string
  ): Promise<[(Readable | FormData)?, number?, string?]> {
    if (request.body == null) {
      return [];
    }

    switch (request.body.type) {
      case RequestBodyType.TEXT: {
        const requestBodyStream = await persistenceService.loadTextBodyOfRequest(request);
        return [environmentService.setVariablesInStream(requestBodyStream!) as Readable];
      }
      case RequestBodyType.FILE:
        return this.readFileBody(request.body.filePath);
      case RequestBodyType.GRAPHQL:
        return this.readGraphQLBody(request.body, request.method, url);
      case RequestBodyType.FORM_DATA: {
        const form = new FormData();
        for (const field of request.body.fields) {
          switch (field.value.type) {
            case RequestBodyType.TEXT:
              form.append(
                field.key,
                await environmentService.setVariablesInString(field.value.text ?? '')
              );
              break;
            case RequestBodyType.FILE: {
              const [body] = await this.readFileBody(field.value.filePath);
              if (body != null) {
                const fileName = field.value.fileName ?? 'file';
                const mimeType = this.getContentType(field.value);
                const value = new File([await buffer(body)], fileName, { type: mimeType });
                form.append(field.key, value);
              }
              break;
            }
            default:
              throw new Error('Unknown form data field value type');
          }
        }
        return [form];
      }
      default:
        throw new Error('Unknown body type');
    }
  }

  private async readGraphQLBody(
    body: GraphQLBody,
    method: string,
    requestUrl: string
  ): Promise<[Readable?, number?, string?]> {
    const { query, variables, operationName } = await this.resolveGraphQLBody(body);

    if (method === 'GET') {
      if (/^\s*mutation\b/i.test(query)) {
        throw new Error('GraphQL mutations cannot be sent over GET');
      }
      const url = new URL(requestUrl);
      url.searchParams.set('query', query);
      if (body.variables?.trim()) url.searchParams.set('variables', JSON.stringify(variables));
      if (operationName != null) url.searchParams.set('operationName', operationName);
      return [undefined, undefined, url.toString()];
    }

    const payload = JSON.stringify({ query, variables, operationName });
    return [Readable.from(payload), Buffer.byteLength(payload)];
  }

  private async resolveGraphQLBody(body: GraphQLBody) {
    const queryInput = await environmentService.setVariablesInString(body.query ?? '');
    const pastedPayload = this.parseGraphQLJsonPayload(queryInput);
    const hasVariablesOverride =
      body.variables != null && body.variables.trim() !== '' && body.variables.trim() !== '{}';
    const variablesText = hasVariablesOverride
      ? await environmentService.setVariablesInString(body.variables ?? '{}')
      : JSON.stringify(pastedPayload?.variables ?? {});

    return {
      query: pastedPayload?.query ?? queryInput,
      variables: this.parseGraphQLVariables(variablesText),
      operationName: body.operationName?.trim() || pastedPayload?.operationName,
    };
  }

  private parseGraphQLJsonPayload(input: string) {
    try {
      const parsed = JSON.parse(input) as {
        query?: unknown;
        variables?: unknown;
        operationName?: unknown;
      };
      if (typeof parsed.query !== 'string') return undefined;
      return {
        query: parsed.query,
        variables: parsed.variables,
        operationName: typeof parsed.operationName === 'string' ? parsed.operationName : undefined,
      };
    } catch {
      return undefined;
    }
  }

  private parseGraphQLVariables(resolvedVariables: string) {
    if (!resolvedVariables.trim()) return {};
    try {
      return JSON.parse(resolvedVariables) as Record<string, unknown>;
    } catch (error) {
      throw new Error('GraphQL variables must be valid JSON', { cause: error });
    }
  }

  private async countGraphQLErrors(request: TrufosRequest, responseBodyPath?: string) {
    if (request.body?.type !== RequestBodyType.GRAPHQL || responseBodyPath == null)
      return undefined;
    try {
      const responseBody = JSON.parse(await fsp.readFile(responseBodyPath, 'utf8')) as {
        errors?: unknown[];
      };
      return Array.isArray(responseBody.errors) ? responseBody.errors.length : undefined;
    } catch {
      return undefined;
    }
  }

  private async readFileBody(filePath?: string): Promise<[Readable?, number?]> {
    if (filePath == null) return [];
    return [await fileSystemService.readFile(filePath), fs.statSync(filePath).size];
  }

  /**
   * Get the content type of the request body
   * @param body request body
   */
  private getContentType(body?: RequestBody) {
    if (body != null) {
      switch (body.type) {
        case RequestBodyType.TEXT:
          return body.mimeType ?? 'text/plain';
        case RequestBodyType.FILE:
          return body.mimeType ?? 'application/octet-stream';
        case RequestBodyType.GRAPHQL:
          return 'application/json';
      }
    }
  }

  private trufosHeadersToUndiciHeaders(trufosHeaders: TrufosHeader[]): HttpHeaders {
    const headers: HttpHeaders = {};
    for (const header of trufosHeaders) {
      if (header.isActive) {
        const key = header.key.toLowerCase();
        if (!Reflect.has(headers, key)) headers[key] = [];
        headers[key].push(header.value);
      }
    }
    return headers;
  }

  private async resolveVariablesInHeaders(headers: HttpHeaders): Promise<HttpHeaders> {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(headers).map(
          async ([key, values]) => [key, await this.resolveVariablesInHeaderValues(values)] as const
        )
      )
    );
  }

  private resolveVariablesInHeaderValues(values: string[]) {
    return Promise.all(values.map((value) => environmentService.setVariablesInString(value)));
  }

  private async executeScript(request: TrufosRequest, type: ScriptType) {
    const stream = await persistenceService.loadScript(request, type);
    if (stream != null) {
      const script = await text(stream);
      scriptingService.executeScript(script);
    }
  }
}

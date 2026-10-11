import undici, { Agent, Dispatcher, FormData } from 'undici';
import { getDurationFromNow, getSteadyTimestamp } from 'main/util/time-util';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable } from 'stream';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { buildUrl } from 'shim/objects/url';
import { UnmatchedVariableError } from 'template-replace-stream';
import { TrufosResponse } from 'shim/objects/response';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { isBlankHeader, TrufosHeader } from 'shim/objects/headers';
import { calculateResponseSize } from 'main/util/size-calculation';
import { app } from 'electron';
import process from 'node:process';
import { BodyStore } from 'main/network/service/body-store';
import { ScriptingService } from 'main/scripting/scripting-service';
import { ScriptType } from 'shim/scripting';
import { text, buffer } from 'node:stream/consumers';
import { DisplayableError } from 'shim/error/DisplayableError';
import { mapRequestError } from 'main/network/service/request-error';
import { HistoryService } from 'main/history/history-service';
import { copyRequestBody } from 'main/network/service/request-body-copy';

const fileSystemService = FileSystemService.instance;
const environmentService = EnvironmentService.instance;
const persistenceService = PersistenceService.instance;
const bodyStore = BodyStore.instance;
const scriptingService = ScriptingService.instance;
const historyService = HistoryService.instance;

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
   * Fetch a resource asynchronously. The response body is written to a temporary file. Any failure
   * is mapped to a user-friendly {@link DisplayableError}.
   * @param request request object
   * @returns response object
   */
  public async fetchAsync(request: TrufosRequest, signal?: AbortSignal): Promise<TrufosResponse> {
    try {
      return await this.doFetchAsync(request, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof DisplayableError) throw error;
      throw mapRequestError(error);
    }
  }

  private async doFetchAsync(request: TrufosRequest, signal?: AbortSignal) {
    // Requests and responses are not logged as a whole as they may contain secrets. They are
    // recorded in the request history instead.
    logger.info(`Sending ${request.method} request ${request.id}`);

    // resolve variables (except in body, which is resolved stream-based during send)
    let url: string;
    try {
      url = await environmentService.setVariablesInString(buildUrl(request.url), true);
    } catch (error) {
      if (error instanceof UnmatchedVariableError) {
        throw new DisplayableError(
          `The variable "${error.variableName}" used in the URL is not defined.`,
          'Undefined Variable',
          error
        );
      }
      throw error;
    }

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
        throw new DisplayableError(
          'Please check your authentication settings and try again.',
          'Authentication Failed',
          e
        );
      }
    }

    const headers = await this.resolveVariablesInHeaders(
      this.trufosHeadersToUndiciHeaders(request.headers)
    );

    // execute pre-request script if it exists
    await this.executeScript(request, ScriptType.PRE_REQUEST);

    const [body, size] = await this.readBody(request);
    const sentHeaders = withoutUnsetHeaders({
      ['content-type']: this.getContentType(request.body),
      ['authorization']: authorization,
      ['content-length']: size?.toString(),
      ['user-agent']: `Trufos/${app.getVersion()} (${process.platform} ${process.getSystemVersion()}; ${process.arch})`,
      ...headers,
    });
    const [sentBody, bodyCopy] = copyRequestBody(body, sentHeaders);
    historyService.recordSentRequest(
      { method: request.method, url, headers: sentHeaders },
      bodyCopy
    );

    // measure duration of the request
    const now = getSteadyTimestamp();
    const responseData = await undici.request(url, {
      dispatcher: await this._dispatcherProvider(),
      method: request.method,
      headers: sentHeaders,
      body: sentBody,
      signal,
    });

    const duration = getDurationFromNow(now);
    logger.info(`Received response in ${duration}ms`);

    // execute post-response script if it exists
    await this.executeScript(request, ScriptType.POST_RESPONSE);

    // write the response body to an encrypted temporary file
    let responseBodyId: string | undefined;
    if (responseData.body != null) {
      const { id, stream } = bodyStore.create(responseData.headers);
      logger.debug('Writing response body', id);
      await pipeline(responseData.body, stream).catch((error: unknown) => {
        bodyStore.remove(id);
        throw error;
      });
      responseBodyId = id;
      logger.debug('Successfully written response body');
    }

    // return a new Response instance
    const response: TrufosResponse = {
      type: 'response',
      metaInfo: {
        status: responseData.statusCode,
        duration: duration,
        size: calculateResponseSize(
          responseData.headers,
          responseBodyId != null ? bodyStore.getSize(responseBodyId) : undefined
        ),
      },
      headers: Object.freeze(responseData.headers),
      id: responseBodyId as string,
    };

    logger.debug(`Returning response ${response.id}`);
    return response;
  }

  /**
   * Read the request body from the file system
   * @param request request object
   * @returns request body as stream or null if there is no body
   */
  private async readBody(request: TrufosRequest): Promise<[(Readable | FormData)?, number?]> {
    if (request.body == null) {
      return [];
    }

    switch (request.body.type) {
      case RequestBodyType.TEXT: {
        // The body file only exists once the request was opened in the editor, so
        // requests that were never opened (e.g. sent via the collection runner) have none.
        const requestBodyStream = await persistenceService.loadTextBodyOfRequest(request);
        if (requestBodyStream == null) return [];
        return [environmentService.setVariablesInStream(requestBodyStream) as Readable];
      }
      case RequestBodyType.FILE:
        return this.readFileBody(request.body.filePath);
      case RequestBodyType.FORM_DATA: {
        const form = new FormData();
        for (const field of request.body.fields) {
          switch (field.value.type) {
            case RequestBodyType.TEXT: {
              form.append(
                field.key,
                await environmentService.setVariablesInString(field.value.text ?? '')
              );
              break;
            }
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
      }
    }
  }

  private trufosHeadersToUndiciHeaders(trufosHeaders: TrufosHeader[]): HttpHeaders {
    const headers: HttpHeaders = {};
    for (const header of trufosHeaders) {
      if (header.isActive && !isBlankHeader(header)) {
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
      scriptingService.executeScript(script, type);
    }
  }
}

function withoutUnsetHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[]> {
  return Object.fromEntries(
    Object.entries(headers).filter(
      (entry): entry is [string, string | string[]] => entry[1] != null
    )
  );
}

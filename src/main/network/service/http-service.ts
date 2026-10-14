import undici, { Agent, Dispatcher, FormData } from 'undici';
import { getDurationFromNow, getSteadyTimestamp } from 'main/util/time-util';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable } from 'stream';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { buildUrl } from 'shim/objects/url';
import { UnmatchedVariableError } from 'template-replace-stream';
import { StoredBody, TrufosResponse } from 'shim/objects/response';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { waitUntilOpen } from 'main/util/fs-util';
import { isBlankHeader, TrufosHeader } from 'shim/objects/headers';
import { calculateResponseSize } from 'main/util/size-calculation';
import { app } from 'electron';
import process from 'node:process';
import { BodyStore } from 'main/network/service/body-store';
import { ScriptingService } from 'main/scripting/scripting-service';
import { ScriptType } from 'shim/scripting';
import { text } from 'node:stream/consumers';
import { DisplayableError } from 'shim/error/DisplayableError';
import { mapRequestError } from 'main/network/service/request-error';
import type { RequestRecorder } from 'main/network/service/request-recorder';
import { copyRequestBody } from 'main/network/service/request-body-copy';

const fileSystemService = FileSystemService.instance;
const environmentService = EnvironmentService.instance;
const persistenceService = PersistenceService.instance;
const bodyStore = BodyStore.instance;
const scriptingService = ScriptingService.instance;

declare type HttpHeaders = Record<string, string[]>;

/**
 * A request together with its files, opened at the moment it is sent. Its scripts are read, its
 * text body is streamed from the file opened then. So editing, saving or discarding the request
 * while it is sent cannot change what is sent, as these replace files instead of changing them.
 */
export interface PreparedRequest {
  request: TrufosRequest;
  /** The opened text body, if the request has a text body that was ever written. */
  textBody?: Readable;
  /** The scripts of the request, by type. */
  scripts: Partial<Record<ScriptType, string>>;
}
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
    const cert = CollectionStateService.instance.model.collection.clientCertificate;
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
   * Opens the files a request needs to be sent: it reads its scripts and opens its text body. Call
   * this while no change of the collection is written, see {@link CollectionStateService.read}.
   * The text body is only streamed by {@link fetchAsync}, which also closes it.
   * @param request the request to prepare
   * @returns the request with the content of its files
   */
  public async prepare(request: TrufosRequest): Promise<PreparedRequest> {
    const [textBody, preRequestScript, postResponseScript] = await Promise.all([
      this.openTextBody(request),
      this.readScript(request, ScriptType.PRE_REQUEST),
      this.readScript(request, ScriptType.POST_RESPONSE),
    ]);
    const scripts: PreparedRequest['scripts'] = {};
    if (preRequestScript != null) scripts[ScriptType.PRE_REQUEST] = preRequestScript;
    if (postResponseScript != null) scripts[ScriptType.POST_RESPONSE] = postResponseScript;
    return { request, textBody, scripts };
  }

  /**
   * Fetch a resource asynchronously. The response body is written to a temporary file. Any failure
   * is mapped to a user-friendly {@link DisplayableError}.
   * @param prepared the request to send, see {@link prepare}
   * @returns response object
   */
  public async fetchAsync(
    prepared: PreparedRequest,
    recorder: RequestRecorder,
    signal?: AbortSignal
  ): Promise<TrufosResponse> {
    try {
      return await this.doFetchAsync(prepared, recorder, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof DisplayableError) throw error;
      throw mapRequestError(error);
    } finally {
      // the body is not streamed if sending failed before, and closing a streamed body is a no-op
      prepared.textBody?.destroy();
    }
  }

  private async doFetchAsync(
    { request, textBody, scripts }: PreparedRequest,
    recorder: RequestRecorder,
    signal?: AbortSignal
  ) {
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
    const preRequestScript = scripts[ScriptType.PRE_REQUEST];
    if (preRequestScript != null) {
      await scriptingService.executeScript(
        preRequestScript,
        ScriptType.PRE_REQUEST,
        recorder.scriptLog
      );
    }

    const [body, size] = await this.readBody(request, textBody);
    const sentHeaders = withoutUnsetHeaders({
      ['content-type']: this.getContentType(request.body),
      ['authorization']: authorization,
      ['content-length']: size?.toString(),
      ['user-agent']: `Trufos/${app.getVersion()} (${process.platform} ${process.getSystemVersion()}; ${process.arch})`,
      ...headers,
    });
    const [sentBody, bodyCopy] = copyRequestBody(body, sentHeaders);
    recorder.sent({ method: request.method, url, headers: sentHeaders }, bodyCopy);

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
    const postResponseScript = scripts[ScriptType.POST_RESPONSE];
    if (postResponseScript != null) {
      await scriptingService.executeScript(
        postResponseScript,
        ScriptType.POST_RESPONSE,
        recorder.scriptLog
      );
    }

    // write the response body to an encrypted temporary file
    let responseBody: StoredBody | undefined;
    if (responseData.body != null) {
      const { id, stream } = bodyStore.create(responseData.headers);
      logger.debug('Writing response body', id);
      await pipeline(responseData.body, stream).catch((error: unknown) => {
        bodyStore.remove(id);
        throw error;
      });
      responseBody = { id, size: bodyStore.getSize(id) ?? 0 };
      logger.debug('Successfully written response body');
    }

    // return a new Response instance
    const response: TrufosResponse = {
      type: 'response',
      metaInfo: {
        status: responseData.statusCode,
        duration: duration,
        size: calculateResponseSize(responseData.headers, responseBody?.size),
      },
      headers: Object.freeze(responseData.headers),
      body: responseBody,
    };

    logger.debug(`Returning response with body ${responseBody?.id}`);
    return response;
  }

  /**
   * Read the request body from the file system
   * @param request request object
   * @returns request body as stream or null if there is no body
   */
  private async readBody(
    request: TrufosRequest,
    textBody?: Readable
  ): Promise<[(Readable | FormData)?, number?]> {
    switch (request.body.type) {
      case RequestBodyType.TEXT: {
        if (textBody == null) return [];
        return [environmentService.setVariablesInStream(textBody) as Readable];
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
              const { filePath } = field.value;
              if (filePath != null) {
                const mimeType = this.getContentType(field.value);
                const file = await fs.openAsBlob(filePath, { type: mimeType });
                form.append(field.key, file, field.value.fileName);
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
    const { size } = await fsp.stat(filePath);
    return [await fileSystemService.readFile(filePath), size];
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

  /**
   * Opens the text body of the request. The body file only exists once the request was opened in
   * the editor, so requests that were never opened (e.g. sent via the collection runner) have none.
   * @returns the opened text body, or `undefined` if the request has none
   */
  private async openTextBody(request: TrufosRequest) {
    if (request.body.type !== RequestBodyType.TEXT) return undefined;
    return await persistenceService.loadTextBodyOfRequest(request).then(waitUntilOpen);
  }

  /**
   * Reads a script of the request completely.
   * @returns the text of the script, or `undefined` if the request has none
   */
  private async readScript(request: TrufosRequest, type: ScriptType) {
    const stream = await persistenceService.loadScript(request, type);
    return stream == null ? undefined : await text(stream);
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

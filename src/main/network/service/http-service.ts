import undici, { FormData } from 'undici';
import { getDurationFromNow, getSteadyTimestamp } from 'main/util/time-util';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable } from 'stream';
import {
  getAuthorizationHeader,
  resolveVariablesInStream,
  resolveVariablesInString,
} from 'main/environment/service/variable-resolver';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { buildUrl } from 'shim/objects/url';
import { UnmatchedVariableError } from 'template-replace-stream';
import { StoredBody, TrufosResponse } from 'shim/objects/response';
import { isBlankHeader, TrufosHeader } from 'shim/objects/headers';
import { calculateResponseSize } from 'main/util/size-calculation';
import { app } from 'electron';
import process from 'node:process';
import { BodyStore } from 'main/network/service/body-store';
import { ScriptingService } from 'main/scripting/scripting-service';
import { ScriptType } from 'shim/scripting';
import { DisplayableError } from 'shim/error/DisplayableError';
import { mapRequestError } from 'main/network/service/request-error';
import type { RequestRecorder, ScriptLogger } from 'main/network/service/request-recorder';
import { copyRequestBody } from 'main/network/service/request-body-copy';
import {
  CollectionChangedError,
  CollectionStateService,
  type PreparedRequest,
} from 'main/collection-state/collection-state-service';
import { HistoryService } from 'main/history/history-service';
import { LatestResponseBodies } from 'main/network/service/latest-response-bodies';
import { TrufosId } from 'shim/objects/id';
import type { CollectionModel } from 'shim/collection-model';
import { DispatcherCache } from 'main/network/service/dispatcher-cache';
import { SettingsService } from 'main/persistence/service/settings-service';

const bodyStore = BodyStore.instance;
const scriptingService = ScriptingService.instance;
const collectionState = CollectionStateService.instance;

declare type HttpHeaders = Record<string, string[]>;

/**
 * Singleton service for making HTTP requests
 */
export class HttpService {
  public static readonly instance = new HttpService();

  private readonly abortControllers = new Map<string, AbortController>();

  /** @param dispatchers provides the dispatcher each request is sent with */
  constructor(private readonly dispatchers: Pick<DispatcherCache, 'get'> = new DispatcherCache()) {}

  /**
   * Sends a request of the open collection as it is now, including its body and scripts, even if
   * it is changed while it is sent. The request is recorded in the history.
   * @param requestId the ID of the request
   * @param abortKey the key to abort the request with, see {@link abortRequest}
   * @returns the response, or null if the request was aborted
   */
  public async sendRequest(requestId: TrufosId, abortKey?: string): Promise<TrufosResponse | null> {
    // registered before anything is awaited, so an abort cannot slip through while preparing
    const abortController = new AbortController();
    if (abortKey != null) this.abortControllers.set(abortKey, abortController);

    let response: TrufosResponse | null;
    let textBody: PreparedRequest['textBody'];
    try {
      const prepared = await collectionState.prepareRequest(requestId);
      textBody = prepared.textBody;
      if (abortController.signal.aborted) {
        logger.debug('Request was aborted while it was prepared:', requestId);
        return null;
      }
      const { request, model } = prepared;
      response = await HistoryService.instance.record(
        request,
        model.collection.dirPath,
        async (recorder) => {
          try {
            return await this.fetchAsync(prepared, recorder, abortController.signal);
          } catch (error) {
            // An aborted request simply has no response. This is the outcome the caller asked for, so
            // it is reported as one instead of as the platform's abort error.
            if (!abortController.signal.aborted) throw error;
            logger.debug('Request was aborted:', request.id);
            return null;
          }
        }
      );
    } finally {
      // another send may have taken over the key meanwhile
      if (abortKey != null && this.abortControllers.get(abortKey) === abortController) {
        this.abortControllers.delete(abortKey);
      }
      // the body is not streamed if sending failed before, and closing a streamed body is a no-op
      textBody?.destroy();
    }

    // the response panel and the collection runner show the latest response of a request
    if (response != null) LatestResponseBodies.instance.set(requestId, response.body?.id);
    return response;
  }

  /** Aborts a request sent with the given abort key, see {@link sendRequest}. */
  public abortRequest(abortKey: string): void {
    this.abortControllers.get(abortKey)?.abort();
    this.abortControllers.delete(abortKey);
  }

  /**
   * Fetch a resource asynchronously. The response body is written to a temporary file. Any failure
   * is mapped to a user-friendly {@link DisplayableError}.
   * @param prepared the request to send. Its text body is not closed. It is sent with the model the
   * pre-request script leaves behind, or with the prepared one if there is no such script.
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
    }
  }

  private async doFetchAsync(
    { request, textBody, scripts, model: preparedModel }: PreparedRequest,
    recorder: RequestRecorder,
    signal?: AbortSignal
  ) {
    // Requests and responses are not logged as a whole as they may contain secrets. They are
    // recorded in the request history instead.
    logger.info(`Sending ${request.method} request ${request.id}`);

    // everything is resolved after the script, so the variables it sets are used
    const model = await this.runScript(
      scripts,
      ScriptType.PRE_REQUEST,
      recorder.scriptLog,
      preparedModel
    );

    // resolve variables (except in body, which is resolved stream-based during send)
    let url: string;
    try {
      url = await resolveVariablesInString(model, buildUrl(request.url), true);
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
        authorization = await getAuthorizationHeader(model, request.auth, {
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
      model,
      this.trufosHeadersToUndiciHeaders(request.headers)
    );

    const [body, size] = await this.readBody(model, request, textBody);
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
      dispatcher: await this.dispatchers.get({
        verifyTlsCertificates: SettingsService.instance.settings.verifyTlsCertificates,
        clientCertificate: model.collection.clientCertificate,
      }),
      method: request.method,
      headers: sentHeaders,
      body: sentBody,
      signal,
    });

    const duration = getDurationFromNow(now);
    logger.info(`Received response in ${duration}ms`);

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

    // runs once the response body is stored, so the script can read it. The response is received
    // already, so it is kept even if the script cannot run anymore
    await this.runScript(scripts, ScriptType.POST_RESPONSE, recorder.scriptLog, model).catch(
      (error: unknown) => {
        if (!(error instanceof CollectionChangedError)) throw error;
        const message =
          'The post-response script was not run, as another collection was opened while the request was sent';
        logger.warn(message);
        recorder.scriptLog({ script: ScriptType.POST_RESPONSE, level: 'warn', args: [message] });
      }
    );

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
    model: CollectionModel,
    request: TrufosRequest,
    textBody?: Readable
  ): Promise<[(Readable | FormData)?, number?]> {
    switch (request.body.type) {
      case RequestBodyType.TEXT: {
        if (textBody == null) return [];
        return [resolveVariablesInStream(model, textBody)];
      }
      case RequestBodyType.FILE:
        return this.readFileBody(request.body.filePath);
      case RequestBodyType.FORM_DATA: {
        const form = new FormData();
        for (const field of request.body.fields) {
          switch (field.value.type) {
            case RequestBodyType.TEXT: {
              form.append(field.key, await resolveVariablesInString(model, field.value.text ?? ''));
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
    const handle = await fsp.open(filePath);
    try {
      const { size } = await handle.stat();
      return [handle.createReadStream(), size];
    } catch (error) {
      await handle.close();
      throw error;
    }
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

  private async resolveVariablesInHeaders(
    model: CollectionModel,
    headers: HttpHeaders
  ): Promise<HttpHeaders> {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(headers).map(
          async ([key, values]) =>
            [
              key,
              await Promise.all(values.map((value) => resolveVariablesInString(model, value))),
            ] as const
        )
      )
    );
  }

  /**
   * Executes a script of a prepared request, if it has one.
   * @returns the model after the script, see {@link ScriptingService.executeScript}
   */
  private async runScript(
    scripts: PreparedRequest['scripts'],
    type: ScriptType,
    log: ScriptLogger,
    model: CollectionModel
  ): Promise<CollectionModel> {
    const script = scripts[type];
    if (script == null) return model;
    return await scriptingService.executeScript(script, type, log, model);
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

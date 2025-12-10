import undici, { Agent, Dispatcher } from 'undici';
import { getDurationFromNow, getSteadyTimestamp } from 'main/util/time-util';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import { Readable } from 'stream';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { buildUrl } from 'shim/objects/url';
import { TrufosResponse } from 'shim/objects/response';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { TrufosHeader } from 'shim/objects/headers';
import { calculateResponseSize } from 'main/util/size-calculation';
import { app } from 'electron';
import process from 'node:process';
import { ResponseBodyService } from 'main/network/service/response-body-service';

const fileSystemService = FileSystemService.instance;
const environmentService = EnvironmentService.instance;
const persistenceService = PersistenceService.instance;
const responseBodyService = ResponseBodyService.instance;

declare type HttpHeaders = Record<string, string[]>;

/**
 * Singleton service for making HTTP requests
 */
export class HttpService {
  public static readonly instance = new HttpService();

  private readonly _dispatcher?: Dispatcher;

  constructor(dispatcher?: Dispatcher) {
    this._dispatcher = dispatcher ?? new Agent({ connect: { rejectUnauthorized: false } }); // allow self-signed certificates
  }

  /**
   * Fetch a resource asynchronously. The response body is written to a temporary file.
   * @param request request object
   * @returns response object
   */
  public async fetchAsync(request: TrufosRequest) {
    logger.info('Sending request:', request);

    // set authorization header if the request has authentication information
    let authorization: string | undefined;
    if (request.auth != null) {
      try {
        logger.debug('Generating authentication header');
        authorization = await environmentService.getAuthorizationHeader(request.auth);
      } catch (e) {
        logger.error('Failed to generate authentication header:', e);
        throw new Error('Please check your authentication settings and try again');
      }
    }

    // resolve variables (except in body, which is resolved stream-based during send)
    const url = await environmentService.setVariablesInString(buildUrl(request.url));
    const headers = await this.resolveVariablesInHeaders(
      this.trufosHeadersToUndiciHeaders(request.headers)
    );

    // measure duration of the request
    const now = getSteadyTimestamp();
    const responseData = await undici.request(url, {
      dispatcher: this._dispatcher,
      method: request.method,
      headers: {
        ['content-type']: this.getContentType(request),
        ['authorization']: authorization,
        ['user-agent']: `Trufos/${app.getVersion()} (${process.platform} ${process.getSystemVersion()}; ${process.arch})`,
        ...headers,
      },
      body: await this.readBody(request),
    });

    const duration = getDurationFromNow(now);
    logger.info(`Received response in ${duration} milliseconds`);

    // write the response body to a temporary file
    const bodyFile = fileSystemService.temporaryFile();
    if (responseData.body != null) {
      logger.debug('Writing response body to temporary file:', bodyFile.name);
      await pipeline(responseData.body, fs.createWriteStream('', { fd: bodyFile.fd }));
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
          responseData.body != null ? bodyFile.name : null
        ),
      },
      headers: Object.freeze(responseData.headers),
      id: responseData.body != null ? responseBodyService.register(bodyFile.name) : undefined,
    };

    logger.debug('Returning response:', response);
    return response;
  }

  /**
   * Read the request body from the file system
   * @param request request object
   * @returns request body as stream or null if there is no body
   */
  private async readBody(request: TrufosRequest): Promise<Readable | null> {
    if (request.body == null) {
      return null;
    }

    switch (request.body.type) {
      case 'text': {
        const requestBodyStream = await persistenceService.loadTextBodyOfRequest(request);
        return environmentService.setVariablesInStream(requestBodyStream) as Readable;
      }
      case 'file':
        if (request.body.filePath == null) return null;
        return fileSystemService.readFile(request.body.filePath);
      default:
        throw new Error('Unknown body type');
    }
  }

  /**
   * Get the content type of the request body
   * @param request request object
   */
  private getContentType(request: TrufosRequest) {
    if (request.body != null) {
      switch (request.body.type) {
        case RequestBodyType.TEXT:
          return request.body.mimeType ?? 'text/plain';
        case RequestBodyType.FILE:
          return request.body.mimeType ?? 'application/octet-stream';
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
}

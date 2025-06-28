import undici, { Dispatcher } from 'undici';
import { getDurationFromNow, getSteadyTimestamp } from 'main/util/time-util';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import { Readable } from 'stream';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { TrufosResponse } from 'shim/objects/response';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { TrufosHeader } from 'shim/objects/headers';
import { calculateResponseSize } from 'main/util/size-calculation';
import { createAuthStrategy } from '../authentication/auth-strategy-factory';

const fileSystemService = FileSystemService.instance;
const environmentService = EnvironmentService.instance;
const persistenceService = PersistenceService.instance;

/**
 * Singleton service for making HTTP requests
 */
export class HttpService {
  public static readonly instance = new HttpService();

  private readonly _dispatcher?: Dispatcher;

  constructor(dispatcher?: Dispatcher) {
    this._dispatcher = dispatcher;
  }

  /**
   * Fetch a resource asynchronously. The response body is written to a temporary file.
   * @param request request object
   * @returns response object
   */
  public async fetchAsync(request: TrufosRequest) {
    logger.info('Sending request:', request);

    // set authorization header if the request has authentication information
    let authorization: string = null;
    if (request.auth != null) {
      logger.debug('Generating authentication header');
      authorization = await createAuthStrategy(request.auth).getAuthHeader();
    }

    // measure duration of the request
    const now = getSteadyTimestamp();
    const responseData = await undici.request(request.url, {
      dispatcher: this._dispatcher,
      method: request.method,
      headers: {
        ['content-type']: this.getContentType(request),
        ['authorization']: authorization,
        ...this.trufosHeadersToUndiciHeaders(request.headers),
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
      metaInfo: {
        status: responseData.statusCode,
        duration: duration,
        size: calculateResponseSize(
          responseData.headers,
          responseData.body != null ? bodyFile.name : null
        ),
      },
      headers: Object.freeze(responseData.headers),
      bodyFilePath: responseData.body != null ? bodyFile.name : null,
    };

    logger.debug('Returning response:', response);
    return response;
  }

  /**
   * Read the request body from the file system
   * @param request request object
   * @returns request body as stream or null if there is no body
   */
  private async readBody(request: TrufosRequest) {
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

  private trufosHeadersToUndiciHeaders(trufosHeaders: TrufosHeader[]) {
    const headers: Record<string, string[]> = {};
    for (const header of trufosHeaders) {
      if (header.isActive && header.value != null) {
        if (!Reflect.has(headers, header.key)) headers[header.key] = [];
        headers[header.key].push(header.value);
      }
    }
    return headers;
  }
}

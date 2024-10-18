import undici, { Dispatcher } from 'undici';
import { getDurationFromNow, getSteadyTimestamp } from 'main/util/time-util';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import { Readable } from 'stream';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { RequestBodyType, RufusRequest } from 'shim/objects/request';
import { RufusResponse } from 'shim/objects/response';
import { PersistenceService } from '../../persistence/service/persistence-service';
import { RufusHeader } from '../../../shim/objects/headers';

const fileSystemService = FileSystemService.instance;
const environmentService = EnvironmentService.instance;
const persistanceService = PersistenceService.instance;

/**
 * Singleton service for making HTTP requests
 */
export class HttpService {

  private static readonly _instance: HttpService = new HttpService();

  private readonly _dispatcher?: Dispatcher;

  constructor(dispatcher?: Dispatcher) {
    this._dispatcher = dispatcher;
  }

  public static get instance() {
    return this._instance;
  }

  /**
   * Fetch a resource asynchronously. The response body is written to a temporary file.
   * @param request request object
   * @returns response object
   */
  public async fetchAsync(request: RufusRequest) {
    console.info('Sending request: ', request);

    const now = getSteadyTimestamp();
    const body = await this.readBody(request);

    const responseData = await undici.request(
      request.url,
      {
        dispatcher: this._dispatcher,
        method: request.method,
        headers: { ['content-type']: this.getContentType(request), ...this.rufusHeadersToUndiciHeaders(request.headers) },
        body: body,
      },
    );

    const duration = getDurationFromNow(now);
    console.info(`Received response in ${duration} milliseconds:`, responseData);

    // write the response body to a temporary file
    const bodyFile = fileSystemService.temporaryFile();
    if (responseData.body != null) {
      console.debug('Writing response body to temporary file: ', bodyFile.name);
      await pipeline(responseData.body, fs.createWriteStream('', { fd: bodyFile.fd }));
      console.debug('Successfully written response body');
    }

    // return a new Response instance
    const response: RufusResponse = {
      status: responseData.statusCode,
      headers: Object.freeze(responseData.headers),
      duration: duration,
      bodyFilePath: responseData.body != null ? bodyFile.name : null,
    };

    console.debug('Returning response: ', response);
    return response;
  }

  /**
   * Read the request body from the file system
   * @param request request object
   * @returns request body as stream or null if there is no body
   */
  private async readBody(request: RufusRequest) {
    if (request.body == null) {
      return null;
    }

    switch (request.body.type) {
      case 'text': {
        const requestBodyStream = await persistanceService.loadTextBodyOfRequest(request);
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
  private getContentType(request: RufusRequest) {
    if (request.body != null) {
      switch (request.body.type) {
        case RequestBodyType.TEXT:
          return request.body.mimeType ?? 'text/plain';
        case RequestBodyType.FILE:
          return request.body.mimeType ?? 'application/octet-stream';
      }
    }
  }

  private rufusHeadersToUndiciHeaders(rufusHeaders: RufusHeader[]) {
    const headers: Record<string, string[]> = {};
    for (const header of rufusHeaders) {
      if (header.isActive && header.value != null) {
        if (!Reflect.has(headers, header.key)) headers[header.key] = [];
        headers[header.key].push(header.value);
      }
    }
    return headers;
  }
}


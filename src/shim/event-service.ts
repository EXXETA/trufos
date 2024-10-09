import { FileInfo } from './fs';
import { RufusRequest } from 'shim/objects/request';
import { RufusResponse } from 'shim/objects/response';

export interface IEventService {

  /**
   * Send an HTTP request.
   * @param request The request to send.
   */
  sendRequest(request: RufusRequest): Promise<RufusResponse>;

  /**
   * Get information about a file or directory.
   * @param filePath The path to the file or directory.
   */
  getFileInfo(filePath: string): Promise<FileInfo>;

  /**
   * Read a file from the file system.
   * @param filePath The path to the file.
   * @param offset The offset in the file to start reading from.
   * @param length The number of bytes to read.
   */
  readFile(filePath: string, offset?: number, length?: number): Promise<ArrayBufferLike>;

  /**
   * Saves the request to the file system. The draft flag is respected. If a
   * body is provided, it is saved as well.
   *
   * @param request The request to save.
   * @param textBody OPTIONAL: The text body of the request.
   */
  saveRequest(request: RufusRequest, textBody?: string): Promise<void>;

  /**
   * @returns The version of the app
   */
  getAppVersion(): Promise<string>;
}

import { FileInfo } from './fs';
import { RufusRequest } from 'shim/objects/request';
import { RufusResponse } from 'shim/objects/response';
import { Collection } from './objects/collection';
import { RufusObject } from './objects/object';

export interface IEventService {

  /**
   * Load the default collection.
   */
  loadCollection(): Promise<Collection>;

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
   * Save changes of the given rufus object to the file system.
   * @param object The object to save.
   * @returns The saved object.
   */
  saveChanges(object: RufusObject): Promise<void>;

  /**
   * Discard changes of the given rufus object.
   * @param object The object to discard changes of.
   * @returns The object with discarded changes, i.e. the persisted non-draft version.
   */
  discardChanges<T extends RufusObject>(object: T): Promise<T>;

  /**
   * Delete the given rufus object and its children.
   * @param object The object to delete.
   */
  deleteObject(object: RufusObject): Promise<void>;

  /**
   * @returns The version of the app
   */
  getAppVersion(): Promise<string>;
}

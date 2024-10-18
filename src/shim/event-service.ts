import { RufusRequest } from 'shim/objects/request';
import { RufusResponse } from 'shim/objects/response';
import { Collection } from './objects/collection';
import { RufusObject } from './objects';

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
   * This does not override the actual rufus object if the given object is a draft.
   * Use {@link saveChanges} to save changes to the actual object.
   *
   * @param request The request to save.
   * @param textBody OPTIONAL: The text body of the request.
   */
  saveRequest(request: RufusRequest, textBody?: string): Promise<void>;

  /**
   * Save changes of the given rufus request to the file system.
   * @param request The request to save.
   * @returns The saved request.
   */
  saveChanges(request: RufusRequest): Promise<RufusRequest>;

  /**
   * Discard changes of the given rufus request.
   * @param request The request to discard changes of.
   * @returns The request with discarded changes, i.e. the persisted non-draft version.
   */
  discardChanges(request: RufusRequest): Promise<RufusRequest>;

  /**
   * Delete the given rufus object and its children.
   * @param object The object to delete.
   */
  deleteObject(object: RufusObject): Promise<void>;

  /**
   * @returns The version of the app
   */
  getAppVersion(): Promise<string>;

  /**
   * Load the text body of the request. The body type must be "text".
   * @param request The request to load the text body of.
   */
  loadTextRequestBody(request: RufusRequest): Promise<string>;
}

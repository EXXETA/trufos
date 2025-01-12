import { TrufosRequest } from 'shim/objects/request';
import { TrufosResponse } from 'shim/objects/response';
import { Collection } from './objects/collection';
import { TrufosObject } from './objects';
import { VariableObject } from './variables';

export interface IEventService {
  /**
   * Load the default collection.
   */
  loadCollection(): Promise<Collection>;

  /**
   * Send an HTTP request.
   * @param request The request to send.
   */
  sendRequest(request: TrufosRequest): Promise<TrufosResponse>;

  /**
   * Saves the request to the file system. The draft flag is respected. If a
   * body is provided, it is saved as well.
   *
   * This does not override the actual trufos object if the given object is a draft.
   * Use {@link saveChanges} to save changes to the actual object.
   *
   * @param request The request to save.
   * @param textBody OPTIONAL: The text body of the request.
   */
  saveRequest(request: TrufosRequest, textBody?: string): Promise<TrufosRequest>;

  /**
   * Save changes of the given trufos request to the file system.
   * @param request The request to save.
   * @returns The saved request.
   */
  saveChanges(request: TrufosRequest): Promise<TrufosRequest>;

  /**
   * Discard changes of the given trufos request.
   * @param request The request to discard changes of.
   * @returns The request with discarded changes, i.e. the persisted non-draft version.
   */
  discardChanges(request: TrufosRequest): Promise<TrufosRequest>;

  /**
   * Delete the given trufos object and its children.
   * @param object The object to delete.
   */
  deleteObject(object: TrufosObject): Promise<void>;

  /**
   * @returns The version of the app
   */
  getAppVersion(): Promise<string>;

  /**
   * @returns all active environment variables. This includes system variables and collection variables.
   */
  getActiveEnvironmentVariables(): Promise<VariableObject[]>;

  /**
   * Get a variable by its key.
   * @param key The key of the variable.
   */
  getVariable(key: string): Promise<VariableObject>;

  /**
   * Set a variable.
   * @param variables
   */
  setAndSaveAllVariables(variables: VariableObject[]): void;
}

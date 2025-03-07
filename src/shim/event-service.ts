import { TrufosRequest } from 'shim/objects/request';
import { TrufosResponse } from 'shim/objects/response';
import { Collection, CollectionBase } from './objects/collection';
import { TrufosObject } from './objects';
import { VariableMap, VariableObject } from './objects/variables';
import { Folder } from 'shim/objects/folder';
import { EnvironmentMap } from './objects/environment';

export interface IEventService {
  /**
   * (Re)load the last opened collection.
   * @param force If true, the collection is reloaded even if it is already loaded.
   */
  loadCollection(force?: boolean): Promise<Collection>;

  /**
   * Lists all recently opened collections.
   */
  listCollections(): Promise<CollectionBase[]>;

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
  getActiveEnvironmentVariables(): Promise<[string, VariableObject][]>;

  /**
   * Get a variable by its key.
   * @param key The key of the variable.
   */
  getVariable(key: string): Promise<VariableObject>;

  /**
   * Replace all existing collection variables with the given ones.
   * @param variables The variables of the Collection to set.
   */
  setCollectionVariables(variables: VariableMap): void;

  /**
   * Replace all existing environment variables with the given ones.
   * @param environmentVariables
   */
  setEnvironmentVariables(environmentVariables: EnvironmentMap): void;

  /**
   * Select an environment by its key.
   * @param key The key of the environment to select.
   */
  selectEnvironment(key: string): void;

  /**
   * Save the folder to the file system.
   * @param folder The folder to save.
   */
  saveFolder(folder: Folder): void;

  /**
   * Open an existing collection at the given directory path.
   * @param dirPath The directory path of the collection.
   */
  openCollection(dirPath: string): Promise<Collection>;

  /**
   * Create a new collection at the given directory path with the given title.
   * @param dirPath The directory path of the new collection. Must be empty.
   * @param title The title of the new collection.
   */
  createCollection(dirPath: string, title: string): Promise<Collection>;

  /**
   * Close the collection at the given directory path. You cannot close the default collection.
   * @param dirPath The directory path of the collection to close. If not provided, the current collection is closed.
   */
  closeCollection(dirPath?: string): Promise<Collection>;

  /**
   * Open a folder dialog and return the selected directory path.
   */
  showOpenDialog(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue>;
}

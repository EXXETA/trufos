import {
  Folder,
  TrufosRequest,
  TrufosResponse,
  TrufosObject,
  Collection,
  CollectionBase,
  VariableMap,
  VariableObject,
  EnvironmentMap,
} from './objects';

export type ImportStrategy = 'Postman' | 'Bruno' | 'Insomnia';

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
   * Copies the given request and returns the copied request.
   * If the request has a non-draft request body, it is copied as well.
   *
   * @param request The request to copy.
   */
  copyRequest(request: TrufosRequest): Promise<TrufosRequest>;

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
  selectEnvironment(key?: string): void;

  /**
   * Save the folder to the file system.
   * @param folder The folder to save.
   */
  saveFolder(folder: Folder): void;

  /**
   * Copies the given folder and all its children and returns the copied folder.
   * If any child has a non-draft request body, it is copied as well.
   *
   * @param folder The folder to copy.
   */
  copyFolder(folder: Folder): Promise<Folder>;

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
   * @returns The now selected collection after closing the specified collection.
   */
  closeCollection(dirPath?: string): Promise<Collection>;

  /**
   * Open a folder dialog and return the selected directory path.
   */
  showOpenDialog(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue>;

  /**
   * Import a collection from a source file into a target directory using the given strategy.
   * The target directory must exist. A new directory will be created inside it using the
   * collection name (or the name the user provides) similar to createCollection semantics.
   * @param srcFilePath The path to the collection export file (e.g. Postman JSON file).
   * @param targetDirPath The existing directory that will contain the imported collection directory.
   * @param strategy The import strategy / tool the file originates from.
   * @param title
   */
  importCollection(
    srcFilePath: string,
    targetDirPath: string,
    strategy: ImportStrategy,
    title?: string
  ): Promise<Collection>;

  /**
   * Rename the given collection, folder, or request to the new title.
   * This updates the title and the directory name if necessary.
   * @param object The object to rename.
   * @param newTitle The new title.
   */
  rename(object: TrufosObject, newTitle: string): Promise<void>;

  /**
   * Moves a child object from one parent to another on the file system.
   * @param child the child object that gets moved
   * @param oldParent the parent object the child is currently in
   * @param newParent the parent object the child gets moved to
   * @param position OPTIONAL: the new position of the child in the new parent. If not provided, the child will be added to the end of the new parent's children
   */
  moveItem(
    child: Folder | TrufosRequest,
    oldParent: Folder | Collection,
    newParent: Folder | Collection,
    position?: number
  ): Promise<void>;

  /**
   * Reorders a child object within its parent folder or collection.
   * @param parent the parent folder or collection
   * @param childId the ID of the child object to reorder
   * @param newIndex the new index of the child object within the parent's children array
   * @returns the updated parent folder or collection
   */
  reorderItem<T extends Folder | Collection>(
    parent: T,
    childId: string,
    newIndex: number
  ): Promise<T>;

  /**
   * Trigger the application update process in the background.
   * Will show a dialog to the user if an update is available.
   */
  updateApp(): void;
}

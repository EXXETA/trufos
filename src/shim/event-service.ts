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
   * Rename the given folder or request to the new title.
   * This updates the title and the directory name if necessary.
   * @param object The folder or request to rename.
   * @param newTitle The new title.
   */
  rename(object: Folder | TrufosRequest, newTitle: string): Promise<void>;

  /**
   * Trigger the application update process in the background.
   * Will show a dialog to the user if an update is available.
   */
  updateApp(): void;

  /**
   * Export the given collection to a ZIP file.
   * @param collection The collection to export.
   * @param outputPath The directory where the ZIP file should be saved.
   * @param includeSecrets Whether to include secrets in the export. Default is false.
   * @param password Optional password to encrypt the ZIP file.
   * @returns The path to the exported ZIP file.
   */
  exportCollection(
    collection: Collection,
    outputPath: string,
    includeSecrets?: boolean,
    password?: string
  ): Promise<string>;
}

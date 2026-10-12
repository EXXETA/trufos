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
  ClientCertificate,
} from './objects';
import { ScriptType } from './scripting';
import { AppSettings } from './app-settings';
import { HistoryEntry, HistoryEntrySummary } from './history';

/**
 * Fire-and-forget IPC events pushed from the main process to the renderer.
 * Every `webContents.send()` call and its renderer-side listener must use this
 * enum so event names stay unique and dead events are easy to spot.
 */
export enum MainProcessEvent {
  /** The window is about to close; the renderer should flush unsaved state. */
  BeforeClose = 'before-close',
  /** The variables or environments of the current collection changed, see {@link CollectionVariablesUpdate}. */
  CollectionVariablesUpdated = 'collection-variables-updated',
  /**
   * The request history changed. The payload is the new history of the current collection, newest
   * first.
   */
  HistoryChanged = 'history-changed',
  /** Opens the app settings modal (app menu). */
  ShowAppSettings = 'show-app-settings',
  /** Opens the collection runner view (Collection menu). */
  ShowCollectionRunner = 'show-collection-runner',
  /** Opens the collection settings modal (Collection menu). */
  ShowCollectionSettings = 'show-collection-settings',
  /** Shows the request history in the sidebar (Collection menu). */
  ShowHistory = 'show-history',
}

/**
 * Fire-and-forget IPC events sent from the renderer to the main process.
 */
export enum RendererEvent {
  /** The renderer finished initializing and the window can be shown. */
  RendererReady = 'renderer-ready',
  /** All unsaved state is flushed; the window may close now. */
  ReadyToClose = 'ready-to-close',
}

/**
 * The payload of every {@link MainProcessEvent}. Sender and listener are both typed from this map,
 * so they cannot disagree. A type is no runtime guarantee though: listeners still validate payloads
 * they take over into state.
 */
export interface MainProcessEventPayloads {
  [MainProcessEvent.BeforeClose]: [];
  [MainProcessEvent.CollectionVariablesUpdated]: [update: CollectionVariablesUpdate];
  [MainProcessEvent.HistoryChanged]: [entries: HistoryEntrySummary[]];
  [MainProcessEvent.ShowAppSettings]: [];
  [MainProcessEvent.ShowCollectionRunner]: [];
  [MainProcessEvent.ShowCollectionSettings]: [];
  [MainProcessEvent.ShowHistory]: [];
}

/** The payload of every {@link RendererEvent}, see {@link MainProcessEventPayloads}. */
export interface RendererEventPayloads {
  [RendererEvent.RendererReady]: [];
  [RendererEvent.ReadyToClose]: [];
}

export type ImportStrategy = 'Postman' | 'OpenAPI' | 'Bruno' | 'Insomnia';

export interface ImportWarning {
  message: string;
  filePath?: string;
  itemName?: string;
  itemType?: string;
}

export interface ImportResult {
  collection: Collection;
  warnings: ImportWarning[];
}

/**
 * Payload of the {@link MainProcessEvent.CollectionVariablesUpdated} event that the main process pushes to the renderer
 * after a script changed collection or environment variables.
 */
export interface CollectionVariablesUpdate {
  variables: VariableMap;
  environments: EnvironmentMap;
}

export type ExportStrategy = 'Zip';

export interface ExportOptions {
  /** When set, the archive is encrypted with AES-256 using this password. */
  password?: string;
  /**
   * When true, each object's secrets (secret variables and auth) are decrypted from their
   * `.secrets.bin` file and written into the archive as plaintext JSON. Independent of `password`.
   */
  includeSecrets?: boolean;
}

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
   * @param abortKey Key under which the request can be aborted via {@link abortRequest}.
   * @returns The response, or `null` if the request was aborted before one arrived.
   */
  sendRequest(request: TrufosRequest, abortKey?: string): Promise<TrufosResponse | null>;

  /**
   * Abort an in-flight HTTP request started with the given abort key.
   * @param abortKey The key passed to sendRequest.
   */
  abortRequest(abortKey: string): void;

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
  discardChanges(request: TrufosRequest): Promise<TrufosRequest | null>;

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
   * Replaces all `{{ someVariable }}` templates in the given string with their current values.
   * @param string The string to resolve the variables in.
   * @returns The resolved string, or null if it references a variable that is not defined.
   */
  resolveVariablesInString(string: string): Promise<string | null>;

  /**
   * Replace all existing collection variables with the given ones.
   * @param variables The variables of the Collection to set.
   */
  setCollectionVariables(variables: VariableMap): void;

  /**
   * Set or clear the client certificate for the current collection.
   * @param clientCertificate The client certificate to set, or null to clear it.
   */
  setClientCertificate(clientCertificate: ClientCertificate | null): Promise<void>;

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
   * Open a save dialog and return the selected file path.
   */
  showSaveDialog(options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue>;

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
  ): Promise<ImportResult>;

  /**
   * Export the collection at the given directory to the given target file.
   * Secrets, drafts, request history, and `.gitignore`d files are excluded from the archive.
   * @param dirPath The directory path of the collection to export.
   * @param targetPath The file path to write the export to.
   * @param strategy The export strategy / target format (e.g. Zip).
   * @param options Optional export settings. Providing a `password` encrypts the archive.
   */
  exportCollection(
    dirPath: string,
    targetPath: string,
    strategy: ExportStrategy,
    options?: ExportOptions
  ): Promise<void>;

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

  /**
   * Saves the script for the given request and script type to the file system.
   * @param request The request the script belongs to.
   * @param type The type of the script (e.g. pre-request)
   * @param script The script content to save.
   */
  saveScript(request: TrufosRequest, type: ScriptType, script: string): Promise<void>;

  /**
   * Save a request or response body to disk. Opens a native save dialog with a suggested filename
   * derived from the Content-Disposition or Content-Type header, then saves the decrypted body to
   * the chosen path. The body never enters the renderer process.
   *
   * @param bodyId The ID of the body to save.
   * @returns The saved file path, or null if the user cancelled or the body is unavailable.
   */
  downloadBody(bodyId: string): Promise<string | null>;

  /**
   * Returns the persisted application settings.
   */
  getAppSettings(): Promise<AppSettings | undefined>;

  /**
   * Persists the application settings to disk.
   * @param settings The new application settings.
   */
  saveAppSettings(settings: AppSettings): Promise<void>;

  /**
   * Opens the directory containing the application log files in the OS file manager.
   */
  openLogDirectory(): Promise<void>;

  /**
   * Lists the request history of the current collection in this session, newest first.
   */
  getHistory(): Promise<HistoryEntrySummary[]>;

  /**
   * Returns a request history entry with headers, body references and script output.
   * @param id The ID of the history entry.
   * @returns The entry, or `undefined` if it was evicted or cleared.
   */
  getHistoryEntry(id: string): Promise<HistoryEntry | undefined>;

  /**
   * Clears the request history of the current collection and deletes its stored bodies. The latest
   * response of each request is kept, as it is still shown in the response panel.
   */
  clearHistory(): Promise<void>;
}

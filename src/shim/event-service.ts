import { TrufosResponse, CollectionBase, VariableObject } from './objects';
import type { CollectionSnapshot, CollectionStateEvent, CommandEnvelope } from './collection-model';
import type { CollectionUiStateInput } from './collection-ui-state';
import { AppSettings } from './app-settings';
import { HistoryEntry, HistoryEntrySummary } from './history';
import type { PluginsSnapshot, QualifiedId } from './plugin/contributions';
import type { ExportOptions, ImportWarning } from './plugin/host';
import type { McpServerStatus } from './mcp';

/**
 * Fire-and-forget IPC events pushed from the main process to the renderer.
 * Every `webContents.send()` call and its renderer-side listener must use this
 * enum so event names stay unique and dead events are easy to spot.
 */
export enum MainProcessEvent {
  /** The window is about to close; the renderer should flush unsaved state. */
  BeforeClose = 'before-close',
  /** The state of the open collection changed, see {@link CollectionStateEvent}. */
  CollectionStateChanged = 'collection-state-changed',
  /**
   * The request history changed. The payload is the new history of the current collection, newest
   * first.
   */
  HistoryChanged = 'history-changed',
  /** The MCP server started, stopped or failed. The payload is the new {@link McpServerStatus}. */
  McpServerStatusChanged = 'mcp-server-status-changed',
  /**
   * A plugin was enabled or disabled, or failed to activate. The payload is the new
   * {@link PluginsSnapshot}.
   */
  PluginsChanged = 'plugins-changed',
  /** Reloads the open collection from disk (Collection menu). */
  ReloadCollection = 'reload-collection',
  /**
   * The text body or a script of these requests of the open collection changed on disk, e.g.
   * outside the app. The payload is the IDs of the requests.
   */
  RequestFilesChanged = 'request-files-changed',
  /**
   * A request of the open collection was sent outside the renderer, e.g. by an MCP client. The
   * payload is the ID of the request and its response, which the response panel shows.
   */
  ResponseReceived = 'response-received',
  /** Opens the app settings modal (app menu). */
  ShowAppSettings = 'show-app-settings',
  /** Opens the collection runner view (Collection menu). */
  ShowCollectionRunner = 'show-collection-runner',
  /** Opens the collection settings modal (Collection menu). */
  ShowCollectionSettings = 'show-collection-settings',
  /** Shows the request history in the sidebar (Collection menu). */
  ShowHistory = 'show-history',
  /** Selects a request of the open collection, e.g. for an MCP client. The payload is its ID. */
  ShowRequest = 'show-request',
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
 * so they cannot disagree. Listeners do not validate the payloads: the main process is the trusted
 * side and builds them from data it validated already, e.g. the collection state from validated
 * commands.
 */
export interface MainProcessEventPayloads {
  [MainProcessEvent.BeforeClose]: [];
  [MainProcessEvent.CollectionStateChanged]: [event: CollectionStateEvent];
  [MainProcessEvent.HistoryChanged]: [entries: HistoryEntrySummary[]];
  [MainProcessEvent.McpServerStatusChanged]: [status: McpServerStatus];
  [MainProcessEvent.PluginsChanged]: [snapshot: PluginsSnapshot];
  [MainProcessEvent.ReloadCollection]: [];
  [MainProcessEvent.RequestFilesChanged]: [requestIds: string[]];
  [MainProcessEvent.ResponseReceived]: [requestId: string, response: TrufosResponse];
  [MainProcessEvent.ShowAppSettings]: [];
  [MainProcessEvent.ShowCollectionRunner]: [];
  [MainProcessEvent.ShowCollectionSettings]: [];
  [MainProcessEvent.ShowHistory]: [];
  [MainProcessEvent.ShowRequest]: [requestId: string];
}

/**
 * Listens to an event pushed by the main process. It receives the Electron IPC event, which most
 * listeners do not need, followed by the payload, see {@link MainProcessEventPayloads}.
 */
export type MainProcessEventListener<E extends MainProcessEvent> = (
  ipcEvent: unknown,
  ...payload: MainProcessEventPayloads[E]
) => void;

/** The payload of every {@link RendererEvent}, see {@link MainProcessEventPayloads}. */
export interface RendererEventPayloads {
  [RendererEvent.RendererReady]: [];
  [RendererEvent.ReadyToClose]: [];
}

export interface ImportResult {
  /** The directory the collection was imported into. Open it to make it the current one. */
  dirPath: string;
  warnings: ImportWarning[];
}

/** A built-in exporter, or the {@link QualifiedId} of an exporter contributed by a plugin. */
export type ExportStrategy = 'Zip' | QualifiedId;

export interface IEventService {
  /**
   * Returns the complete state of the open collection. Afterwards, the state is kept up to date
   * with {@link MainProcessEvent.CollectionStateChanged} events.
   */
  getCollectionState(): Promise<CollectionSnapshot>;

  /**
   * Stores the UI state of an open collection, so it is part of its next snapshot. It is ignored
   * if the collection is not open (anymore).
   * @param dirPath The directory of the collection.
   * @param uiState The UI state of the collection.
   */
  saveCollectionUiState(dirPath: string, uiState: CollectionUiStateInput): Promise<void>;

  /**
   * Applies a command to the open collection and persists the change. The resulting patches are
   * broadcast as {@link MainProcessEvent.CollectionStateChanged}. The IPC does not order the reply
   * and the broadcast, so this may resolve before the patches arrive.
   * @param envelope The command to apply.
   * @returns the model version the command was applied as
   * @throws if the command is invalid or cannot be applied
   */
  dispatch(envelope: CommandEnvelope): Promise<number>;

  /**
   * Lists all recently opened collections.
   */
  listCollections(): Promise<CollectionBase[]>;

  /**
   * Send a request of the open collection in its current state, including unsaved changes.
   * @param requestId The ID of the request to send.
   * @param abortKey Key under which the request can be aborted via {@link abortRequest}.
   * @returns The response, or `null` if the request was aborted before one arrived.
   */
  sendRequest(requestId: string, abortKey?: string): Promise<TrufosResponse | null>;

  /**
   * Abort an in-flight HTTP request started with the given abort key.
   * @param abortKey The key passed to sendRequest.
   */
  abortRequest(abortKey: string): void;

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
  getVariable(key: string): Promise<VariableObject | undefined>;

  /**
   * Replaces all `{{ someVariable }}` templates in the given string with their current values.
   * @param string The string to resolve the variables in.
   * @returns The resolved string, or null if it references a variable that is not defined.
   */
  resolveVariablesInString(string: string): Promise<string | null>;

  /**
   * Open an existing collection at the given directory path.
   * The new state is broadcast as a snapshot before this resolves.
   * @param dirPath The directory path of the collection.
   */
  openCollection(dirPath: string): Promise<void>;

  /**
   * Create a new collection at the given directory path with the given title.
   * @param dirPath The directory path of the new collection. Must be empty.
   * @param title The title of the new collection.
   */
  createCollection(dirPath: string, title: string): Promise<void>;

  /**
   * Close the collection at the given directory path. You cannot close the default collection.
   * @param dirPath The directory path of the collection to close. If not provided, the current collection is closed.
   */
  closeCollection(dirPath?: string): Promise<void>;

  /**
   * Writes all pending changes of the open collection to disk, so its files match the state of
   * the app, e.g. before the files may be changed outside the app.
   */
  flushCollection(): Promise<void>;

  /**
   * Reloads the open collection from disk and broadcasts it as a snapshot, e.g. after its files
   * were changed outside the app. Pending changes are written first.
   * @throws if the collection cannot be read. The app keeps its state then.
   */
  reloadCollection(): Promise<void>;

  /**
   * Like {@link reloadCollection}, but only broadcasts a snapshot if the files differ from the
   * state of the app. Text bodies and scripts are not part of that state, so whoever shows them
   * has to load them again to see a change.
   */
  reloadCollectionIfChanged(): Promise<void>;

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
   * @param strategy The {@link QualifiedId} of the importer of a plugin to use.
   * @param title
   */
  importCollection(
    srcFilePath: string,
    targetDirPath: string,
    strategy: QualifiedId,
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
   * Trigger the application update process in the background.
   * Will show a dialog to the user if an update is available.
   */
  updateApp(): void;

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
  getAppSettings(): Promise<AppSettings>;

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

  /**
   * Returns all plugins, whether they can be used or not, and the contributions of the enabled
   * ones. Afterwards, they are kept up to date with {@link MainProcessEvent.PluginsChanged} events.
   */
  getPlugins(): Promise<PluginsSnapshot>;

  /**
   * Enables or disables a plugin and stores the choice. A disabled plugin is deactivated. The change
   * is broadcast as {@link MainProcessEvent.PluginsChanged}.
   * @param id The ID of the plugin.
   * @param enabled Whether the plugin is enabled.
   */
  setPluginEnabled(id: string, enabled: boolean): Promise<void>;

  /**
   * Returns whether the MCP server runs. Afterwards, it is kept up to date with
   * {@link MainProcessEvent.McpServerStatusChanged} events.
   */
  getMcpServerStatus(): Promise<McpServerStatus>;

  /**
   * Returns the access token of the MCP server, creating it if there is none yet.
   */
  getMcpToken(): Promise<string>;

  /**
   * Replaces the access token of the MCP server. Clients using the old one are rejected from now on.
   * @returns the new access token
   */
  regenerateMcpToken(): Promise<string>;
}

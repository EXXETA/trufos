import { TrufosResponse, CollectionBase, VariableObject } from './objects';
import type { CollectionSnapshot, CollectionStateEvent, CommandEnvelope } from './collection-model';
import type { CollectionUiStateInput } from './collection-ui-state';
import { AppSettings } from './app-settings';
import { HistoryEntry, HistoryEntrySummary } from './history';
import type { PluginsSnapshot, QualifiedId } from './plugin/contributions';
import type { ExportOptions, ImportWarning } from './plugin/host';

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
  /**
   * A plugin was enabled or disabled, or failed to activate. The payload is the new
   * {@link PluginsSnapshot}.
   */
  PluginsChanged = 'plugins-changed',
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
 * so they cannot disagree. Listeners do not validate the payloads: the main process is the trusted
 * side and builds them from data it validated already, e.g. the collection state from validated
 * commands.
 */
export interface MainProcessEventPayloads {
  [MainProcessEvent.BeforeClose]: [];
  [MainProcessEvent.CollectionStateChanged]: [event: CollectionStateEvent];
  [MainProcessEvent.HistoryChanged]: [entries: HistoryEntrySummary[]];
  [MainProcessEvent.PluginsChanged]: [snapshot: PluginsSnapshot];
  [MainProcessEvent.ShowAppSettings]: [];
  [MainProcessEvent.ShowCollectionRunner]: [];
  [MainProcessEvent.ShowCollectionSettings]: [];
  [MainProcessEvent.ShowHistory]: [];
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

/** A built-in importer, or the {@link QualifiedId} of an importer contributed by a plugin. */
export type ImportStrategy = 'OpenAPI' | 'Bruno' | 'Insomnia' | QualifiedId;

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
}

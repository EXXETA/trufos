import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import {
  getVariable,
  getVariables,
  resolveVariablesInString,
} from 'main/environment/service/variable-resolver';
import { HttpService } from 'main/network/service/http-service';
import type { TrufosResponse, IEventService, ImportResult, ExportStrategy } from 'shim';
import { AppSettings } from 'shim/app-settings';
import { MainProcessEvent, type IpcResult, type OAuth2Endpoints } from 'shim/event-service';
import type { CollectionSnapshot } from 'shim/collection-model';
import { CollectionUiState } from 'shim/collection-ui-state';
import { StateService } from 'main/persistence/service/state-service';
import type { CollectionBase } from 'shim/objects/collection';
import { sendToRenderer } from './send-to-renderer';
import { SettingsService } from '../persistence/service/settings-service';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { ImportService } from 'main/import/service/import-service';
import { ExportService } from 'main/export/service/export-service';
import { BodyStore } from 'main/network/service/body-store';
import { getSuggestedFilename } from 'main/network/response-filename';
import { DisplayableError } from 'shim/error/DisplayableError';
import { HistoryService } from 'main/history/history-service';
import type { HistoryEntry, HistoryEntrySummary } from 'shim/history';
import { PluginService } from 'main/plugin/plugin-service';
import type { ExportOptions, PluginsSnapshot, QualifiedId } from 'shim/plugin';
import { McpServerService } from 'main/mcp/mcp-server-service';
import { McpAccessToken } from 'main/mcp/access-token';
import type { McpServerStatus } from 'shim/mcp';

// register stream events
import './stream-events';

const collectionState = CollectionStateService.instance;
const httpService = HttpService.instance;
const importService = ImportService.instance;
const exportService = ExportService.instance;

/**
 * Runs an IPC handler and turns its outcome into an {@link IpcResult}. A {@link DisplayableError}
 * is returned serialized (see {@link DisplayableError.serialize}) so its title and description
 * survive IPC; any other error is returned as an Error object.
 *
 * @param handler The function to run.
 */
async function toIpcResult<R>(handler: () => Promise<R>): Promise<IpcResult<R>> {
  try {
    return { ok: true, value: await handler() };
  } catch (error) {
    logger.error(error);
    return {
      ok: false,
      error: error instanceof DisplayableError ? error.serialize() : toError(error),
    };
  }
}

/**
 * Registers a function to be called when the corresponding event is received via IPC.
 * @param instance The instance of the class containing the function.
 * @param functionName The name of the function to register.
 */
function registerEvent<T>(instance: T, functionName: keyof T) {
  if (typeof functionName !== 'string' || functionName === 'constructor') return;

  const method = instance[functionName];
  if (typeof method === 'function') {
    logger.debug(`Registering event function "${functionName}()" on backend`);
    ipcMain.handle(functionName, (_event, ...args) =>
      toIpcResult<unknown>(async () => method.apply(instance, args))
    );
  }
}

function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }
  return new Error(error?.toString());
}

/**
 * Service for handling events on the main process coming from the renderer process. Every method on
 * its prototype can be called by the renderer, so helpers do not belong on this class as methods.
 */
export class MainEventService implements IEventService {
  public static readonly instance = new MainEventService();

  /**
   * The {@link BrowserWindow} that owns the renderer this service communicates with. Used to push
   * notifications to the renderer and as the parent for dialogs so they appear as modal sheets
   * attached to the window.
   */
  public window: BrowserWindow | null = null;

  private constructor() {
    for (const propertyName of Reflect.ownKeys(MainEventService.prototype)) {
      registerEvent(this, propertyName as keyof MainEventService);
    }
    // the renderer replicates the open collection from these events
    collectionState.on('changed', (event) =>
      sendToRenderer(this.window?.webContents, MainProcessEvent.CollectionStateChanged, event)
    );
    // the renderer reloads the text bodies and scripts it shows in its editors
    collectionState.on('request-files-changed', (requestIds) =>
      sendToRenderer(this.window?.webContents, MainProcessEvent.RequestFilesChanged, requestIds)
    );
    // the renderer shows the history of the current collection
    const pushHistory = () =>
      sendToRenderer(
        this.window?.webContents,
        MainProcessEvent.HistoryChanged,
        HistoryService.instance.list(collectionState.model.collection.dirPath)
      );
    HistoryService.instance.on('changed', pushHistory);
    collectionState.on('collection-changed', pushHistory);
    // the renderer lists the plugins and the contributions of the enabled ones
    PluginService.instance.on('changed', () =>
      sendToRenderer(
        this.window?.webContents,
        MainProcessEvent.PluginsChanged,
        PluginService.instance.snapshot
      )
    );
    // the renderer shows what MCP clients do, and the status of the server in the settings
    const mcpServer = McpServerService.instance;
    mcpServer.on('status-changed', (status) =>
      sendToRenderer(this.window?.webContents, MainProcessEvent.McpServerStatusChanged, status)
    );
    mcpServer.on('response-received', (requestId, response) =>
      sendToRenderer(
        this.window?.webContents,
        MainProcessEvent.ResponseReceived,
        requestId,
        response
      )
    );
    mcpServer.on('show-request', (requestId) =>
      sendToRenderer(this.window?.webContents, MainProcessEvent.ShowRequest, requestId)
    );
    logger.debug('Registered event channels on backend');
  }

  async getCollectionState(): Promise<CollectionSnapshot> {
    return collectionState.snapshot;
  }

  async saveCollectionUiState(dirPath: string, uiState: unknown): Promise<void> {
    await StateService.instance.saveUiState(dirPath, CollectionUiState.parse(uiState));
  }

  async dispatch(envelope: unknown): Promise<number> {
    return await collectionState.dispatch(envelope);
  }

  async listCollections(): Promise<CollectionBase[]> {
    return await collectionState.listCollections();
  }

  async sendRequest(requestId: string, abortKey?: string): Promise<TrufosResponse | null> {
    return await httpService.sendRequest(requestId, abortKey);
  }

  async abortRequest(abortKey: string): Promise<void> {
    httpService.abortRequest(abortKey);
  }

  async discoverOAuth2Endpoints(issuerUrl: string): Promise<OAuth2Endpoints> {
    return await httpService.discoverOAuth2Endpoints(issuerUrl);
  }

  async getAppVersion() {
    return app.getVersion();
  }

  // the variables are read on the queue, so the edits the renderer dispatched before are applied
  async getActiveEnvironmentVariables() {
    return await collectionState.read(getVariables);
  }

  async getVariable(key: string) {
    return await collectionState.read((model) => getVariable(model, key));
  }

  async resolveVariablesInString(string: string) {
    return await collectionState
      .read((model) => resolveVariablesInString(model, string, true))
      .catch(() => null);
  }

  async openCollection(dirPath: string): Promise<void> {
    await collectionState.load(dirPath);
  }

  async createCollection(dirPath: string, title: string): Promise<void> {
    await collectionState.createCollection(dirPath, title);
  }

  async closeCollection(dirPath?: string): Promise<void> {
    await collectionState.closeCollection(dirPath);
  }

  async flushCollection(): Promise<void> {
    await collectionState.flush();
  }

  async reloadCollection(): Promise<void> {
    await collectionState.reload();
  }

  async reloadCollectionIfChanged(): Promise<void> {
    await collectionState.reloadIfChanged();
  }

  async showOpenDialog(options: Electron.OpenDialogOptions) {
    return await dialog.showOpenDialog(this.window!, options);
  }

  async showSaveDialog(options: Electron.SaveDialogOptions) {
    return await dialog.showSaveDialog(this.window!, options);
  }

  async importCollection(
    srcFilePath: string,
    targetDirPath: string,
    strategy: QualifiedId,
    title?: string
  ): Promise<ImportResult> {
    const { collection, warnings } = await importService.importCollection(
      srcFilePath,
      targetDirPath,
      strategy,
      title
    );
    return { dirPath: collection.dirPath, warnings };
  }

  async exportCollection(
    dirPath: string,
    targetPath: string,
    strategy: ExportStrategy,
    options?: ExportOptions
  ) {
    await exportService.exportCollection(dirPath, targetPath, strategy, options);
  }

  async downloadBody(bodyId: string): Promise<string | null> {
    const headers = BodyStore.instance.getHeaders(bodyId);
    if (!headers) {
      logger.warn(`Body not found for ID: ${bodyId}`);
      return null;
    }

    const defaultPath = getSuggestedFilename(headers);
    const { canceled, filePath: chosenPath } = await dialog.showSaveDialog(this.window!, {
      defaultPath,
    });

    if (canceled || !chosenPath) {
      return null;
    }

    return await BodyStore.instance.saveTo(bodyId, chosenPath);
  }

  async getAppSettings(): Promise<AppSettings> {
    return SettingsService.instance.settings;
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
    await SettingsService.instance.setSettings(AppSettings.parse(settings));
  }

  async getHistory(): Promise<HistoryEntrySummary[]> {
    return HistoryService.instance.list(collectionState.model.collection.dirPath);
  }

  async getHistoryEntry(id: string): Promise<HistoryEntry | undefined> {
    return HistoryService.instance.get(id);
  }

  async clearHistory(): Promise<void> {
    HistoryService.instance.clear(collectionState.model.collection.dirPath);
  }

  async getPlugins(): Promise<PluginsSnapshot> {
    return PluginService.instance.snapshot;
  }

  async setPluginEnabled(id: string, enabled: boolean): Promise<void> {
    await PluginService.instance.setEnabled(id, enabled);
  }

  async getMcpServerStatus(): Promise<McpServerStatus> {
    return McpServerService.instance.status;
  }

  async getMcpToken(): Promise<string> {
    return await McpAccessToken.instance.get();
  }

  async regenerateMcpToken(): Promise<string> {
    return await McpAccessToken.instance.regenerate();
  }

  async openLogDirectory(): Promise<void> {
    const error = await shell.openPath(app.getPath('logs'));
    if (error !== '') {
      throw new Error(`Could not open log directory: ${error}`);
    }
  }
}

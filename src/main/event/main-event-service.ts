import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { HttpService } from 'main/network/service/http-service';
import type {
  TrufosResponse,
  IEventService,
  ImportStrategy,
  ExportStrategy,
  ExportOptions,
  AppSettings,
} from 'shim';
import { MainProcessEvent } from 'shim/event-service';
import type { CollectionModel } from 'shim/collection-model';
import type { CollectionBase } from 'shim/objects/collection';
import { sendToRenderer } from './send-to-renderer';
import { SettingsService } from '../persistence/service/settings-service';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { ImportService } from 'main/import/service/import-service';
import { ExportService } from 'main/export/service/export-service';
import { BodyStore } from 'main/network/service/body-store';
import { getSuggestedFilename } from 'main/network/response-filename';
import { updateElectronApp } from 'update-electron-app';
import { DisplayableError } from 'shim/error/DisplayableError';
import { HistoryService } from 'main/history/history-service';
import { LatestResponseBodies } from 'main/network/service/latest-response-bodies';
import type { HistoryEntry, HistoryEntrySummary } from 'shim/history';

// register stream events
import './stream-events';

const collectionState = CollectionStateService.instance;
const environmentService = EnvironmentService.instance;
const importService = ImportService.instance;
const exportService = ExportService.instance;

declare type AsyncFunction<R> = (...args: unknown[]) => Promise<R>;

/**
 * Wraps an async function with an error handler that catches any errors thrown by the function.
 * A {@link DisplayableError} is returned as a serialized payload (see {@link DisplayableError.serialize})
 * so its title and description survive IPC; any other error is returned as an Error object.
 *
 * @param fn The function to wrap.
 */
function wrapWithErrorHandler<F extends AsyncFunction<R>, R>(fn: F) {
  return async function (...args: Parameters<F>) {
    try {
      return (await fn(...args)) as R;
    } catch (error) {
      logger.error(error);
      if (error instanceof DisplayableError) {
        return error.serialize();
      }
      return toError(error);
    }
  };
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
    const boundMethod = (method as unknown as AsyncFunction<unknown>).bind(instance);
    ipcMain.handle(functionName as string, (_event, ...args) =>
      wrapWithErrorHandler(boundMethod)(...args)
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
 * Service for handling events on the main process coming from the renderer process.
 */
export class MainEventService implements IEventService {
  public static readonly instance = new MainEventService();

  /**
   * The {@link BrowserWindow} that owns the renderer this service communicates with. Used to push
   * notifications to the renderer and as the parent for dialogs so they appear as modal sheets
   * attached to the window.
   */
  public window: BrowserWindow | null = null;
  private readonly abortControllers = new Map<string, AbortController>();

  private constructor() {
    for (const propertyName of Reflect.ownKeys(MainEventService.prototype)) {
      registerEvent(this, propertyName as keyof MainEventService);
    }
    // the renderer replicates the open collection from these events
    collectionState.on('changed', (event) =>
      sendToRenderer(this.window?.webContents, MainProcessEvent.CollectionStateChanged, event)
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
    logger.debug('Registered event channels on backend');
  }

  async getCollectionState(): Promise<CollectionModel> {
    return collectionState.model;
  }

  async dispatch(envelope: unknown): Promise<void> {
    await collectionState.dispatch(envelope);
  }

  async listCollections(): Promise<CollectionBase[]> {
    return await collectionState.listCollections();
  }

  async sendRequest(requestId: string, abortKey?: string): Promise<TrufosResponse | null> {
    // the request is sent as it is on disk, including its body and scripts
    await collectionState.flush();
    const { model } = collectionState;
    const request = model.requests.get(requestId);
    if (request == null) throw new Error(`Request ${requestId} does not exist`);

    // only a request sent with an abort key can be aborted, see abortRequest()
    const abortController = new AbortController();
    if (abortKey != null) this.abortControllers.set(abortKey, abortController);

    const { dirPath } = model.collection;
    const response = await HistoryService.instance.record(request, dirPath, async (recorder) => {
      try {
        return await HttpService.instance.fetchAsync(request, recorder, abortController.signal);
      } catch (error) {
        // An aborted request simply has no response. This is the outcome the caller asked for, so
        // it is reported as one instead of as the platform's abort error.
        if (!abortController.signal.aborted) throw error;
        logger.debug('Request was aborted:', request.id);
        return null;
      } finally {
        if (abortKey != null) this.abortControllers.delete(abortKey);
      }
    });

    // the response panel and the collection runner show the latest response of a request
    if (response != null) LatestResponseBodies.instance.set(request.id, response.body?.id);
    return response;
  }

  async abortRequest(abortKey: string) {
    this.abortControllers.get(abortKey)?.abort();
    this.abortControllers.delete(abortKey);
  }

  async getAppVersion() {
    return app.getVersion();
  }

  async getActiveEnvironmentVariables() {
    return environmentService.getVariables();
  }

  async getVariable(key: string) {
    return environmentService.getVariable(key);
  }

  async resolveVariablesInString(string: string) {
    return await environmentService.setVariablesInString(string, true).catch(() => null);
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

  async showOpenDialog(options: Electron.OpenDialogOptions) {
    return await dialog.showOpenDialog(this.window!, options);
  }

  async showSaveDialog(options: Electron.SaveDialogOptions) {
    return await dialog.showSaveDialog(this.window!, options);
  }

  async importCollection(
    srcFilePath: string,
    targetDirPath: string,
    strategy: ImportStrategy,
    title?: string
  ) {
    return await importService.importCollection(srcFilePath, targetDirPath, strategy, title);
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

  async getAppSettings(): Promise<AppSettings | undefined> {
    return SettingsService.instance.settings.preferences;
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
    await SettingsService.instance.updateSettings({ preferences: settings });
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

  async openLogDirectory(): Promise<void> {
    const error = await shell.openPath(app.getPath('logs'));
    if (error !== '') {
      throw new Error(`Could not open log directory: ${error}`);
    }
  }

  updateApp() {
    const prefixMessage = (message: string) => `[UPDATER]: ${message}`;
    updateElectronApp({
      logger: {
        log: (message: string) => logger.info(prefixMessage(message)),
        info: (message: string) => logger.info(prefixMessage(message)),
        error: (message: string) => logger.error(prefixMessage(message)),
        warn: (message: string) => logger.warn(prefixMessage(message)),
      },
      updateInterval: '1 hour',
    });
  }
}

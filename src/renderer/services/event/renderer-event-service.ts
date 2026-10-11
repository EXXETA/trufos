import { MainProcessError } from '@/error/MainProcessError';
import { DisplayableError } from 'shim/error/DisplayableError';
import {
  IEventService,
  MainProcessEvent,
  MainProcessEventPayloads,
  RendererEvent,
  RendererEventPayloads,
} from 'shim/event-service';

/**
 * Creates a method that sends an IPC event to the main process and returns the result. If the
 * result is an error, it is thrown.
 * @param methodName The name of the event method to call in the main process.
 */
function createEventMethod<T extends keyof IEventService>(methodName: T) {
  return async function (
    ...args: Parameters<IEventService[T]>
  ): Promise<
    ReturnType<IEventService[T]> extends Promise<infer R> ? R : ReturnType<IEventService[T]>
  > {
    const result = await window.electron.ipcRenderer.invoke(methodName, ...args);
    if (DisplayableError.isSerialized(result)) {
      throw DisplayableError.deserialize(result);
    } else if (result instanceof Error) {
      throw new MainProcessError(result.message);
    } else {
      return result;
    }
  };
}

export class RendererEventService implements IEventService {
  public static readonly instance = new RendererEventService();

  /**
   * Listens to an event pushed by the main process.
   * @param event the event
   * @param listener receives the Electron IPC event, which most listeners do not need, followed by
   * the payload, see {@link MainProcessEventPayloads}
   */
  on<E extends MainProcessEvent>(
    event: E,
    listener: (ipcEvent: unknown, ...payload: MainProcessEventPayloads[E]) => void
  ): this {
    window.electron.ipcRenderer.on(event, listener);
    return this;
  }

  /**
   * Sends an event to the main process.
   * @param event the event
   * @param payload the payload of the event, see {@link RendererEventPayloads}
   */
  emit<E extends RendererEvent>(event: E, ...payload: RendererEventPayloads[E]): this {
    window.electron.ipcRenderer.send(event, ...payload);
    return this;
  }

  saveRequest = createEventMethod('saveRequest');
  copyRequest = createEventMethod('copyRequest');
  sendRequest = createEventMethod('sendRequest');
  abortRequest = createEventMethod('abortRequest');
  getAppVersion = createEventMethod('getAppVersion');
  loadCollection = createEventMethod('loadCollection');
  saveChanges = createEventMethod('saveChanges');
  discardChanges = createEventMethod('discardChanges');
  deleteObject = createEventMethod('deleteObject');
  getActiveEnvironmentVariables = createEventMethod('getActiveEnvironmentVariables');
  getVariable = createEventMethod('getVariable');
  resolveVariablesInString = createEventMethod('resolveVariablesInString');
  setCollectionVariables = createEventMethod('setCollectionVariables');
  setEnvironmentVariables = createEventMethod('setEnvironmentVariables');
  saveFolder = createEventMethod('saveFolder');
  copyFolder = createEventMethod('copyFolder');
  selectEnvironment = createEventMethod('selectEnvironment');
  openCollection = createEventMethod('openCollection');
  createCollection = createEventMethod('createCollection');
  closeCollection = createEventMethod('closeCollection');
  showOpenDialog = createEventMethod('showOpenDialog');
  showSaveDialog = createEventMethod('showSaveDialog');
  listCollections = createEventMethod('listCollections');
  importCollection = createEventMethod('importCollection');
  exportCollection = createEventMethod('exportCollection');
  rename = createEventMethod('rename');
  moveItem = createEventMethod('moveItem');
  // @ts-expect-error - typing does not work for genric methods
  reorderItem = createEventMethod('reorderItem');
  updateApp = createEventMethod('updateApp');
  saveScript = createEventMethod('saveScript');
  downloadResponse = createEventMethod('downloadResponse');
  setClientCertificate = createEventMethod('setClientCertificate');
  getAppSettings = createEventMethod('getAppSettings');
  saveAppSettings = createEventMethod('saveAppSettings');
  openLogDirectory = createEventMethod('openLogDirectory');
  getHistory = createEventMethod('getHistory');
  getHistoryEntry = createEventMethod('getHistoryEntry');
  clearHistory = createEventMethod('clearHistory');
}

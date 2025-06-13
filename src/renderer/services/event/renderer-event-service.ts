import { IEventService } from 'shim/event-service';
import { MainProcessError } from '@/error/MainProcessError';

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
    if (result instanceof Error) {
      throw new MainProcessError(result.message);
    } else {
      return result;
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface RendererEventService {
  on(event: 'before-close', listener: () => void): this;

  emit(event: 'ready-to-close'): this;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class RendererEventService implements IEventService {
  public static readonly instance = new RendererEventService();

  on(event: string, listener: (...args: unknown[]) => void) {
    window.electron.ipcRenderer.on(event, listener);
    return this;
  }

  emit(event: string, ...args: unknown[]) {
    window.electron.ipcRenderer.send(event, ...args);
    return this;
  }

  saveRequest = createEventMethod('saveRequest');
  sendRequest = createEventMethod('sendRequest');
  getAppVersion = createEventMethod('getAppVersion');
  loadCollection = createEventMethod('loadCollection');
  saveChanges = createEventMethod('saveChanges');
  discardChanges = createEventMethod('discardChanges');
  deleteObject = createEventMethod('deleteObject');
  getActiveEnvironmentVariables = createEventMethod('getActiveEnvironmentVariables');
  getVariable = createEventMethod('getVariable');
  setCollectionVariables = createEventMethod('setCollectionVariables');
  setEnvironmentVariables = createEventMethod('setEnvironmentVariables');
  saveFolder = createEventMethod('saveFolder');
  selectEnvironment = createEventMethod('selectEnvironment');
  openCollection = createEventMethod('openCollection');
  createCollection = createEventMethod('createCollection');
  closeCollection = createEventMethod('closeCollection');
  showOpenDialog = createEventMethod('showOpenDialog');
  listCollections = createEventMethod('listCollections');
}

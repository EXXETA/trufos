import { IEventService } from 'shim/event-service';
import { MainProcessError } from '@/error/MainProcessError';

const METHOD_NAMES = new Set<keyof IEventService>([
  'saveRequest',
  'readFile',
  'getFileInfo',
  'sendRequest',
  'getAppVersion',
  'loadCollection',
  'saveChanges',
  'discardChanges',
  'deleteObject'
]);

const INSTANCE = {} as IEventService;
for (const methodName of METHOD_NAMES) {
  Reflect.defineProperty(INSTANCE, methodName, {
    value: createEventMethod(methodName),
    writable: false,
    enumerable: true,
    configurable: false
  });
}

/**
 * Creates a method that sends an IPC event to the main process and returns the result. If the
 * result is an error, it is thrown.
 * @param methodName The name of the event method to call in the main process.
 */
function createEventMethod(methodName: keyof IEventService) {
  return async function(...args: any[]) {
    const result = await window.electron.ipcRenderer.invoke(methodName, ...args);
    if (result instanceof Error) {
      throw new MainProcessError(result.message);
    } else {
      return result;
    }
  };
}

export const RendererEventService = {
  /** The singleton instance of the RendererEventService */
  instance: INSTANCE
};

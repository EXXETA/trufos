import './stream-events';
import { IEventService } from 'shim/event-service';
import { HttpService } from 'main/network/service/http-service';
import { app, ipcMain } from 'electron';
import { TrufosRequest } from 'shim/objects/request';
import { PersistenceService } from '../persistence/service/persistence-service';
import { TrufosObject } from 'shim/objects';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { VariableMap } from 'shim/objects/variables';
import { Folder } from 'shim/objects/folder';

const persistenceService = PersistenceService.instance;
const environmentService = EnvironmentService.instance;

declare type AsyncFunction<R> = (...args: unknown[]) => Promise<R>;

/**
 * Wraps an async function with an error handler that catches any errors thrown by the function and returns them as an Error object.
 *
 * @param fn The function to wrap.
 */
function wrapWithErrorHandler<F extends AsyncFunction<R>, R>(fn: F) {
  return async function (...args: Parameters<F>) {
    try {
      return (await fn(...args)) as R;
    } catch (error) {
      logger.error(error);
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
    ipcMain.handle(functionName as string, (_event, ...args) =>
      wrapWithErrorHandler(method as unknown as AsyncFunction<unknown>)(...args)
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

  private constructor() {
    for (const propertyName of Reflect.ownKeys(MainEventService.prototype)) {
      registerEvent(this, propertyName as keyof MainEventService);
    }
    logger.debug('Registered event channels on backend');
  }

  async loadCollection(force?: boolean) {
    if (force) {
      return await environmentService.changeCollection(
        environmentService.currentCollection.dirPath
      );
    }
    return environmentService.currentCollection;
  }

  async sendRequest(request: TrufosRequest) {
    return await HttpService.instance.fetchAsync(request);
  }

  async saveRequest(request: TrufosRequest, textBody?: string) {
    return await persistenceService.saveRequest(request, textBody);
  }

  async saveChanges(request: TrufosRequest) {
    return await persistenceService.saveChanges(request);
  }

  async discardChanges(request: TrufosRequest) {
    return await persistenceService.discardChanges(request);
  }

  async getAppVersion() {
    return app.getVersion();
  }

  async deleteObject(object: TrufosObject) {
    await persistenceService.delete(object);
  }

  async getActiveEnvironmentVariables() {
    return environmentService.getVariables();
  }

  async getVariable(key: string) {
    return environmentService.getVariable(key);
  }

  async setCollectionVariables(variables: VariableMap) {
    environmentService.setCollectionVariables(variables);
    await persistenceService.saveCollection(environmentService.currentCollection);
  }

  async selectEnvironment(key: string) {
    environmentService.currentEnvironmentKey = key;
  }

  async saveFolder(folder: Folder) {
    await persistenceService.saveFolder(folder);
  }

  async openCollection(dirPath: string) {
    return await persistenceService.loadCollection(dirPath);
  }

  async createCollection(dirPath: string, title: string) {
    return await persistenceService.createCollection(dirPath, title);
  }

  async closeCollection(dirPath?: string) {
    return await environmentService.closeCollection(dirPath);
  }
}

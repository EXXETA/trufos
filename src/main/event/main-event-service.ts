import { IEventService } from 'shim/event-service';
import { HttpService } from 'main/network/service/http-service';
import { app, ipcMain } from 'electron';
import { FileHandle, open, readFile, stat } from 'node:fs/promises';
import { FileInfo } from 'shim/fs';
import { RequestBodyType, RufusRequest } from 'shim/objects/request';
import { Buffer } from 'node:buffer';
import { PersistenceService } from '../persistence/service/persistence-service';
import { RufusObject } from 'shim/objects/object';
import * as console from 'node:console';

const persistenceService = PersistenceService.instance;

declare type AsyncFunction<R> = (...args: unknown[]) => Promise<R>;

/**
 * Wraps an async function with an error handler that catches any errors thrown by the function and returns them as an Error object.
 *
 * @param fn The function to wrap.
 */
function wrapWithErrorHandler<F extends AsyncFunction<R>, R>(fn: F) {
  return async function(...args: Parameters<F>) {
    try {
      return (await fn(...args)) as R;
    } catch (error) {
      console.error(error);
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
  if (typeof functionName !== 'string' || functionName === 'constructor')
    return;

  const method = instance[functionName];
  if (typeof method === 'function') {
    console.debug(`Registering event function "${functionName}()" on backend`);
    ipcMain.handle(functionName as string, (_event, ...args) =>
      wrapWithErrorHandler(method as unknown as AsyncFunction<unknown>)(...args),
    );
  }
}

function toError(error: any) {
  if (error instanceof Error) {
    return error;
  }
  return new Error(error);
}

/**
 * Service for handling events on the main process coming from the renderer process.
 */
export class MainEventService implements IEventService {
  public static readonly instance = new MainEventService();

  constructor() {
    for (const propertyName of Reflect.ownKeys(MainEventService.prototype)) {
      registerEvent(this, propertyName as keyof MainEventService);
    }
    console.debug('Registered event channels on backend');
  }

  async loadCollection() {
    return await persistenceService.loadDefaultCollection();
  }

  async sendRequest(request: RufusRequest) {
    return await HttpService.instance.fetchAsync(request);
  }

  async getFileInfo(filePath: string) {
    const stats = await stat(filePath);
    return {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      atime: stats.atime,
      mtime: stats.mtime,
      ctime: stats.ctime,
      birthtime: stats.birthtime,
    } as FileInfo;
  }

  async readFile(filePath: string, offset = 0, length?: number) {
    console.debug(
      'Reading file at',
      filePath,
      'with offset',
      offset,
      'and length limited to',
      length ?? 'unlimited',
      'bytes',
    );
    if (offset === 0 && length === undefined) {
      return (await readFile(filePath)).buffer;
    }

    let file: FileHandle | null = null;
    try {
      // get file size if length is not provided
      if (length === undefined) {
        const stats = await stat(filePath);
        length = Math.max(stats.size - offset, 0);
      }

      const buffer = Buffer.alloc(length);
      file = await open(filePath);
      const read = await file.read(buffer, 0, length, offset);
      console.debug('Read', read.bytesRead, 'bytes from file');
      return buffer.subarray(0, read.bytesRead).buffer;
    } finally {
      if (file !== null) await file.close();
    }
  }

  async saveRequest(
    request: RufusRequest,
    textBody?: string,
  ) {
    await persistenceService.save(request, textBody);
  }

  async saveChanges(request: RufusRequest) {
    return await persistenceService.saveChanges(request);
  }

  async discardChanges(request: RufusRequest) {
    return await persistenceService.discardChanges(request);
  }

  async getAppVersion() {
    return app.getVersion();
  }

  async deleteObject(object: RufusObject) {
    await persistenceService.delete(object);
  }

  async loadTextRequestBody(request: RufusRequest) {
    let text = '';

    // TODO: Do not load the entire body into memory. Use ITextSnapshot instead
    if (request.body?.type === RequestBodyType.TEXT) {
      for await (const chunk of await persistenceService.loadTextBodyOfRequest(request)) {
        text += chunk;
      }
    }

    return text;
  }
}

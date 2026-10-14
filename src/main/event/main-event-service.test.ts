import path from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { fs } from 'memfs';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Collection } from 'shim/objects/collection';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { TrufosResponse } from 'shim/objects/response';
import { RequestMethod } from 'shim/objects/request-method';
import { CollectionModel, CommandType, normalizeCollection } from 'shim/collection-model';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { MainProcessEvent } from 'shim/event-service';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getPath: vi.fn().mockReturnValue(''),
  },
  shell: {
    openPath: vi.fn(),
  },
}));

vi.mock('./stream-events', () => ({}));
vi.mock('main/network/service/http-service', () => ({
  HttpService: {
    instance: {
      prepare: vi.fn(),
      fetchAsync: vi.fn(),
    },
  },
}));

function makeModel(variables: Collection['variables'] = {}): CollectionModel {
  const collectionId = randomUUID();
  return normalizeCollection({
    id: collectionId,
    type: 'collection',
    title: 'Test',
    isDefault: false,
    variables,
    environments: {},
    dirPath: '/test',
    lastModified: Date.now(),
    children: [
      {
        id: randomUUID(),
        type: 'request',
        title: 'Test Request',
        parentId: collectionId,
        method: RequestMethod.GET,
        url: { base: 'http://example.com', query: [] },
        headers: [],
        body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
        draft: false,
        lastModified: Date.now(),
      },
    ],
  });
}

const TEST_STRING = 'Hello, World!';
const TEST_FILE_PATH = path.join(tmpdir(), 'test.txt');

describe('MainEventService', () => {
  let MainEventService: Awaited<
    // @ts-expect-error ReturnType on module namespace is not callable but works at runtime
    ReturnType<typeof import('./main-event-service')>
  >['MainEventService'];

  beforeEach(async () => {
    fs.writeFileSync(TEST_FILE_PATH, TEST_STRING);
    // @ts-expect-error dynamic import type inference
    ({ MainEventService } = await import('./main-event-service'));

    // Every test builds its own MainEventService, and each one subscribes to the shared
    // HistoryService and CollectionStateService. Lift the cap so those accumulating subscriptions
    // are not mistaken for a listener leak once the suite grows past Node's default of ten.
    const { HistoryService } = await import('../history/history-service.js');
    HistoryService.instance.setMaxListeners(0);
    CollectionStateService.instance.setMaxListeners(0);
  });

  it('should register event functions on the backend', async () => {
    expect((await import('electron')).ipcMain.handle).toHaveBeenCalled();
  });

  describe('collection state', () => {
    it('getCollectionState() returns the model', async () => {
      const model = makeModel();
      vi.spyOn(CollectionStateService.instance, 'model', 'get').mockReturnValue(model);

      await expect(new MainEventService().getCollectionState()).resolves.toBe(model);
    });

    it('dispatch() passes the envelope to the collection state', async () => {
      const dispatch = vi
        .spyOn(CollectionStateService.instance, 'dispatch')
        .mockResolvedValue(undefined);
      const envelope = {
        commandId: 'id',
        timestamp: 1,
        command: { type: CommandType.UPDATE_COLLECTION, changes: { title: 'New' } },
      } as const;

      await new MainEventService().dispatch(envelope);

      expect(dispatch).toHaveBeenCalledWith(envelope);
    });

    it('forwards changes of the collection state to the renderer', () => {
      const webContentsSend = vi.fn();
      const eventService = new MainEventService();
      eventService.window = { webContents: { send: webContentsSend } } as never;
      const event = { kind: 'snapshot', model: makeModel() } as const;

      CollectionStateService.instance.emit('changed', event);

      expect(webContentsSend).toHaveBeenCalledWith(MainProcessEvent.CollectionStateChanged, event);
    });

    it.each([
      ['openCollection', 'load', ['/dir']],
      ['createCollection', 'createCollection', ['/dir', 'title']],
      ['closeCollection', 'closeCollection', ['/dir']],
    ] as const)('%s() delegates to the collection state', async (method, target, args) => {
      const spy = vi.spyOn(CollectionStateService.instance, target).mockResolvedValue(undefined);
      const eventService = new MainEventService();

      await expect(eventService[method](...args)).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledWith(...args);
    });
  });

  describe('sendRequest', () => {
    let model: CollectionModel;
    let request: TrufosRequest;

    const makeResponse = (): TrufosResponse => ({
      type: 'response',
      body: { id: randomUUID(), size: 0 },
      headers: {},
      metaInfo: {
        status: 200,
        duration: 1,
        size: { totalSizeInBytes: 0, headersSizeInBytes: 0, bodySizeInBytes: 0 },
      },
    });

    beforeEach(async () => {
      // a collection is always loaded before requests can be sent
      model = makeModel();
      request = model.requests.values().next().value!;
      vi.spyOn(CollectionStateService.instance, 'model', 'get').mockImplementation(() => model);
      vi.spyOn(CollectionStateService.instance, 'read').mockImplementation(
        async (reader) => await reader(model)
      );
      const { HttpService } = await import('../network/service/http-service.js');
      vi.mocked(HttpService.instance.prepare).mockImplementation(async (request) => ({
        request,
        scripts: {},
      }));
    });

    it('sends the request of the model as it is when it is read', async () => {
      const { HttpService } = await import('../network/service/http-service.js');
      let reading = false;
      vi.mocked(CollectionStateService.instance.read).mockImplementation(async (reader) => {
        reading = true;
        try {
          return await reader(model);
        } finally {
          reading = false;
        }
      });
      const prepared = { request, textBody: Readable.from('body'), scripts: {} };
      vi.mocked(HttpService.instance.prepare).mockImplementation(async () => {
        expect(reading).toBe(true);
        return prepared;
      });
      vi.mocked(HttpService.instance.fetchAsync).mockResolvedValue(makeResponse());

      await new MainEventService().sendRequest(request.id);

      expect(HttpService.instance.prepare).toHaveBeenCalledWith(request);
      expect(HttpService.instance.fetchAsync).toHaveBeenCalledWith(
        prepared,
        expect.anything(),
        expect.any(AbortSignal)
      );
    });

    it('fails if the request does not exist', async () => {
      const { HttpService } = await import('../network/service/http-service.js');

      await expect(new MainEventService().sendRequest('missing')).rejects.toThrow(
        'Request missing does not exist'
      );
      expect(HttpService.instance.prepare).not.toHaveBeenCalled();
      expect(HttpService.instance.fetchAsync).not.toHaveBeenCalled();
    });

    it('keeps the latest response body of a request alive', async () => {
      const { HttpService } = await import('../network/service/http-service.js');
      const { LatestResponseBodies } = await import('../network/service/latest-response-bodies.js');
      const response = makeResponse();
      vi.mocked(HttpService.instance.fetchAsync).mockResolvedValue(response);
      const setLatest = vi.spyOn(LatestResponseBodies.instance, 'set');

      await new MainEventService().sendRequest(request.id);

      expect(setLatest).toHaveBeenCalledWith(request.id, response.body!.id);
    });

    it('records the request in the history', async () => {
      const { HistoryService } = await import('../history/history-service.js');
      HistoryService.instance.clear(model.collection.dirPath);
      const { HttpService } = await import('../network/service/http-service.js');
      vi.mocked(HttpService.instance.fetchAsync).mockResolvedValue(makeResponse());
      const webContentsSend = vi.fn();
      const eventService = new MainEventService();
      eventService.window = { webContents: { send: webContentsSend } } as never;

      await eventService.sendRequest(request.id);

      const [entry] = await eventService.getHistory();
      expect(entry).toMatchObject({
        requestId: request.id,
        outcome: { type: 'response', status: 200 },
      });
      expect(await eventService.getHistoryEntry(entry.id)).toMatchObject({ id: entry.id });
      expect(webContentsSend).toHaveBeenCalledWith(MainProcessEvent.HistoryChanged, [
        expect.objectContaining({ requestId: request.id }),
      ]);

      await eventService.clearHistory();
      expect(await eventService.getHistory()).toEqual([]);
    });

    it('pushes the history of the new collection when the collection changes', () => {
      const webContentsSend = vi.fn();
      const eventService = new MainEventService();
      eventService.window = { webContents: { send: webContentsSend } } as never;

      CollectionStateService.instance.emit('collection-changed');

      expect(webContentsSend).toHaveBeenCalledWith(
        MainProcessEvent.HistoryChanged,
        expect.any(Array)
      );
    });

    it('passes an abort signal for keyed requests and aborts it by key', async () => {
      const { HttpService } = await import('../network/service/http-service.js');
      let signal: AbortSignal | undefined;
      vi.mocked(HttpService.instance.fetchAsync).mockImplementation(
        (_request, _recorder, abortSignal) => {
          signal = abortSignal;
          return new Promise((_, reject) => {
            abortSignal?.addEventListener('abort', () => reject(new Error('aborted')));
          });
        }
      );

      const eventService = new MainEventService();
      const requestPromise = eventService
        .sendRequest(request.id, 'runner-request-1')
        .catch(() => undefined);
      await vi.waitFor(() => expect(signal).toBeDefined());

      await eventService.abortRequest('runner-request-1');
      await requestPromise;

      expect(signal?.aborted).toBe(true);
    });

    it('resolves an aborted request with null instead of failing', async () => {
      const { HttpService } = await import('../network/service/http-service.js');
      let signal: AbortSignal | undefined;
      vi.mocked(HttpService.instance.fetchAsync).mockImplementation(
        (_request, _recorder, abortSignal) => {
          signal = abortSignal;
          return new Promise((_, reject) => {
            // What undici actually rejects with on abort: a DOMException, whose read-only properties
            // break both logging and IPC serialization.
            abortSignal?.addEventListener('abort', () =>
              reject(new DOMException('This operation was aborted', 'AbortError'))
            );
          });
        }
      );

      const eventService = new MainEventService();
      const requestPromise = eventService.sendRequest(request.id, 'runner-request-2');
      await vi.waitFor(() => expect(signal).toBeDefined());

      await eventService.abortRequest('runner-request-2');

      await expect(requestPromise).resolves.toBeNull();
    });

    it('rethrows a non-abort failure unchanged', async () => {
      const { HttpService } = await import('../network/service/http-service.js');
      const failure = new Error('connection refused');
      vi.mocked(HttpService.instance.fetchAsync).mockRejectedValue(failure);

      const eventService = new MainEventService();

      await expect(eventService.sendRequest(request.id, 'runner-request-3')).rejects.toBe(failure);
    });
  });

  describe('resolveVariablesInString', () => {
    const mockCollectionVariables = async (variables: Collection['variables']) => {
      vi.spyOn(CollectionStateService.instance, 'model', 'get').mockReturnValue(
        makeModel(variables)
      );
    };

    it('should return the string with all variables replaced', async () => {
      await mockCollectionVariables({ baseUrl: { value: 'https://example.com' } });
      const eventService = new MainEventService();

      await expect(eventService.resolveVariablesInString('{{ baseUrl }}/users')).resolves.toBe(
        'https://example.com/users'
      );
    });

    it('should return null when a variable is not defined', async () => {
      await mockCollectionVariables({});
      const eventService = new MainEventService();

      await expect(
        eventService.resolveVariablesInString('{{ missing }}/users')
      ).resolves.toBeNull();
    });
  });

  describe('openLogDirectory', () => {
    it('should open the log directory in the file manager', async () => {
      const { app, shell } = await import('electron');
      vi.mocked(app.getPath).mockReturnValueOnce('/logs');
      vi.mocked(shell.openPath).mockResolvedValueOnce('');
      const eventService = new MainEventService();

      await eventService.openLogDirectory();

      expect(app.getPath).toHaveBeenCalledWith('logs');
      expect(shell.openPath).toHaveBeenCalledWith('/logs');
    });

    it('should throw when the directory could not be opened', async () => {
      const { shell } = await import('electron');
      vi.mocked(shell.openPath).mockResolvedValueOnce('Failed to open path');
      const eventService = new MainEventService();

      await expect(eventService.openLogDirectory()).rejects.toThrow('Failed to open path');
    });
  });
});

import path from 'node:path';
import { tmpdir } from 'node:os';
import { fs } from 'memfs';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Collection } from 'shim/objects/collection';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { TrufosResponse } from 'shim/objects/response';
import { RequestMethod } from 'shim/objects/request-method';
import { CollectionModel, CommandType, normalizeCollection } from 'shim/collection-model';
import { CollectionStateService } from 'main/collection-state/collection-state-service';
import { CollectionUiState } from 'shim/collection-ui-state';
import { MainProcessEvent } from 'shim/event-service';
import { PluginService } from 'main/plugin/plugin-service';

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
      sendRequest: vi.fn(),
      abortRequest: vi.fn(),
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

function makeResponse(): TrufosResponse {
  return {
    type: 'response',
    body: { id: randomUUID(), size: 0 },
    headers: {},
    metaInfo: {
      status: 200,
      duration: 1,
      size: { totalSizeInBytes: 0, headersSizeInBytes: 0, bodySizeInBytes: 0 },
    },
  };
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
    // HistoryService, CollectionStateService and PluginService. Lift the cap so those accumulating subscriptions
    // are not mistaken for a listener leak once the suite grows past Node's default of ten.
    const { HistoryService } = await import('../history/history-service.js');
    HistoryService.instance.setMaxListeners(0);
    CollectionStateService.instance.setMaxListeners(0);
    PluginService.instance.setMaxListeners(0);
  });

  it('should register event functions on the backend', async () => {
    expect((await import('electron')).ipcMain.handle).toHaveBeenCalled();
  });

  describe('collection state', () => {
    it('getCollectionState() returns the snapshot', async () => {
      const snapshot = { model: makeModel(), ui: CollectionUiState.parse({}) };
      vi.spyOn(CollectionStateService.instance, 'snapshot', 'get').mockReturnValue(snapshot);

      await expect(new MainEventService().getCollectionState()).resolves.toBe(snapshot);
    });

    it('saveCollectionUiState() validates the UI state and stores it', async () => {
      const { StateService } = await import('../persistence/service/state-service.js');
      const saveUiState = vi.spyOn(StateService.instance, 'saveUiState').mockResolvedValue();
      const eventService = new MainEventService();

      await eventService.saveCollectionUiState('/dir', { openFolders: ['f1'] } as never);
      await expect(
        eventService.saveCollectionUiState('/dir', { openFolders: 42 } as never)
      ).rejects.toThrow();

      expect(saveUiState).toHaveBeenCalledExactlyOnceWith(
        '/dir',
        CollectionUiState.parse({ openFolders: ['f1'] })
      );
    });

    it('dispatch() passes the envelope to the collection state', async () => {
      const dispatch = vi.spyOn(CollectionStateService.instance, 'dispatch').mockResolvedValue(7);
      const envelope = {
        commandId: 'id',
        timestamp: 1,
        command: { type: CommandType.UPDATE_COLLECTION, changes: { title: 'New' } },
      } as const;

      await expect(new MainEventService().dispatch(envelope)).resolves.toBe(7);

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
      ['flushCollection', 'flush', []],
      ['reloadCollection', 'reload', []],
    ] as const)('%s() delegates to the collection state', async (method, target, args) => {
      const spy = vi.spyOn(CollectionStateService.instance, target).mockResolvedValue(undefined);
      const eventService = new MainEventService();

      await expect(eventService[method](...args)).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledWith(...args);
    });

    it('reloadCollectionIfChanged() returns whether the collection state reloaded', async () => {
      vi.spyOn(CollectionStateService.instance, 'reloadIfChanged').mockResolvedValue(true);
      const eventService = new MainEventService();

      await expect(eventService.reloadCollectionIfChanged()).resolves.toBe(true);
    });
  });

  describe('sendRequest', () => {
    it('delegates sending and aborting to the http service', async () => {
      // Arrange
      const { HttpService } = await import('../network/service/http-service.js');
      vi.mocked(HttpService.instance.sendRequest).mockResolvedValue(null);
      const eventService = new MainEventService();

      // Act
      const response = await eventService.sendRequest('r1', 'key');
      await eventService.abortRequest('key');

      // Assert
      expect(response).toBeNull();
      expect(HttpService.instance.sendRequest).toHaveBeenCalledWith('r1', 'key');
      expect(HttpService.instance.abortRequest).toHaveBeenCalledWith('key');
    });
  });

  describe('history', () => {
    let model: CollectionModel;
    let request: TrufosRequest;

    beforeEach(() => {
      model = makeModel();
      request = model.requests.values().next().value!;
      vi.spyOn(CollectionStateService.instance, 'model', 'get').mockImplementation(() => model);
    });

    it('lists, pushes and clears the history of the current collection', async () => {
      // Arrange
      const { HistoryService } = await import('../history/history-service.js');
      HistoryService.instance.clear(model.collection.dirPath);
      const webContentsSend = vi.fn();
      const eventService = new MainEventService();
      eventService.window = { webContents: { send: webContentsSend } } as never;

      // Act
      await HistoryService.instance.record(request, model.collection.dirPath, async () =>
        makeResponse()
      );

      // Assert
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

  describe('plugins', () => {
    it('pushes the plugins and their contributions when they change', () => {
      const webContentsSend = vi.fn();
      const eventService = new MainEventService();
      eventService.window = { webContents: { send: webContentsSend } } as never;

      PluginService.instance.emit('changed');

      expect(webContentsSend).toHaveBeenCalledWith(MainProcessEvent.PluginsChanged, {
        plugins: [],
        contributions: { importers: [], exporters: [] },
      });
    });

    it('enables a plugin', async () => {
      const setEnabled = vi.spyOn(PluginService.instance, 'setEnabled').mockResolvedValueOnce();
      const eventService = new MainEventService();

      await eventService.setPluginEnabled('postman', false);

      expect(setEnabled).toHaveBeenCalledWith('postman', false);
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

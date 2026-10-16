import path from 'node:path';
import fs from 'node:fs/promises';
import { applyPatches } from 'immer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exists, USER_DATA_DIR } from 'main/util/fs-util';
import { DRAFT_DIR_NAME } from 'main/persistence/constants';
import type { PersistenceService } from 'main/persistence/service/persistence-service';
import type { SettingsService } from 'main/persistence/service/settings-service';
import {
  CollectionCommand,
  CollectionModel,
  CollectionStateEvent,
  CommandEnvelope,
  CommandType,
} from 'shim/collection-model';
import { Collection } from 'shim/objects/collection';
import { RequestBodyType, TEXT_BODY_FILE_NAME, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { parseUrl } from 'shim/objects/url';
import type {
  CollectionStateService,
  REQUEST_INFO_DEBOUNCE_MS as DebounceMs,
} from './collection-state-service';

const firstDirPath = path.join(USER_DATA_DIR, 'collections', 'first');
const secondDirPath = path.join(USER_DATA_DIR, 'collections', 'second');

let persistenceService: PersistenceService;
let settingsService: SettingsService;
let service: CollectionStateService;
let REQUEST_INFO_DEBOUNCE_MS: typeof DebounceMs;
let events: CollectionStateEvent[];

function request(id: string, parentId: string, overrides: Partial<TrufosRequest> = {}) {
  return {
    id,
    parentId,
    type: 'request',
    lastModified: 0,
    title: id,
    url: parseUrl('http://example.com'),
    method: RequestMethod.GET,
    headers: [],
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    draft: false,
    ...overrides,
  } satisfies TrufosRequest;
}

function collection(id: string, dirPath: string, requestIds: string[]): Collection {
  return {
    id,
    type: 'collection',
    title: id,
    dirPath,
    isDefault: false,
    lastModified: 0,
    variables: {},
    environments: { dev: { variables: {} }, prod: { variables: {} } },
    children: requestIds.map((requestId) => request(requestId, id)),
  };
}

function envelope(command: CollectionCommand, commandId = 'cmd'): CommandEnvelope {
  return { commandId, timestamp: 1, command };
}

function readRequestInfo(...segments: string[]): Promise<{ method: string }> {
  return fs
    .readFile(path.join(firstDirPath, ...segments, 'request.json'), 'utf-8')
    .then((text) => JSON.parse(text));
}

describe('CollectionStateService', () => {
  beforeEach(async () => {
    // the services are loaded fresh for every test, as the persistence service remembers the
    // directories of the IDs, which are the same in every test
    vi.resetModules();
    ({
      PersistenceService: { instance: persistenceService },
    } = await import('../persistence/service/persistence-service.js'));
    ({
      SettingsService: { instance: settingsService },
    } = await import('../persistence/service/settings-service.js'));
    const module = await import('./collection-state-service.js');
    REQUEST_INFO_DEBOUNCE_MS = module.REQUEST_INFO_DEBOUNCE_MS;
    service = new module.CollectionStateService();

    await persistenceService.saveCollection(collection('first', firstDirPath, ['r1', 'r2']), true);
    await persistenceService.saveCollection(
      collection('second', secondDirPath, ['s1', 's2']),
      true
    );
    await service.load(firstDirPath);

    events = [];
    service.on('changed', (event) => events.push(event));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('load()', () => {
    it('loads the collection, makes it the current one and broadcasts a snapshot', async () => {
      // Act
      await service.load(secondDirPath);

      // Assert
      expect(service.model.collection.id).toBe('second');
      expect(service.model.childIds.get('second')).toEqual(expect.arrayContaining(['s1', 's2']));
      expect(events).toEqual([{ kind: 'snapshot', model: service.model }]);
      const { settings } = settingsService;
      expect(settings.collections[settings.currentCollectionIndex]).toBe(secondDirPath);
    });

    it('loads the saved state of requests with a draft', async () => {
      // Arrange
      await service.apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });
      await service.flush();

      // Act
      await service.load(firstDirPath);

      // Assert
      expect(service.model.requests.get('r1')).toMatchObject({
        draft: true,
        method: RequestMethod.PUT,
      });
      expect(service.model.savedRequests.get('r1')).toMatchObject({ method: RequestMethod.GET });
    });

    it('keeps the selected environment when the same collection is reloaded', async () => {
      // Arrange
      await service.apply({ type: CommandType.SELECT_ENVIRONMENT, key: 'prod' });

      // Act
      await service.load(firstDirPath);

      // Assert
      expect(service.model.selectedEnvironmentKey).toBe('prod');
    });

    it('only announces a change to another collection', async () => {
      // Arrange
      const changed = vi.fn();
      service.on('collection-changed', changed);

      // Act
      await service.load(firstDirPath);
      await service.load(secondDirPath);

      // Assert
      expect(changed).toHaveBeenCalledOnce();
    });

    it('never decreases the version', async () => {
      // Arrange
      await service.apply({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'renamed' } });
      const { version } = service.model;

      // Act
      await service.load(secondDirPath);

      // Assert
      expect(service.model.version).toBeGreaterThan(version);
    });
  });

  describe('closeCollection()', () => {
    it('loads the default collection when the current one is closed', async () => {
      // Arrange
      await persistenceService.createDefaultCollectionIfNotExists();

      // Act
      await service.closeCollection();

      // Assert
      const { SettingsService } = await import('../persistence/service/settings-service.js');
      expect(service.model.collection.dirPath).toBe(SettingsService.DEFAULT_COLLECTION_DIR);
      const { settings } = settingsService;
      expect(settings.collections).not.toContain(firstDirPath);
      expect(settings.collections[settings.currentCollectionIndex]).toBe(
        SettingsService.DEFAULT_COLLECTION_DIR
      );
    });

    it('keeps the current collection when another one is closed', async () => {
      // Arrange
      await service.load(secondDirPath);
      events.length = 0;

      // Act
      await service.closeCollection(firstDirPath);

      // Assert
      expect(service.model.collection.id).toBe('second');
      expect(events).toEqual([]);
      const { settings } = settingsService;
      expect(settings.collections).not.toContain(firstDirPath);
      expect(settings.collections[settings.currentCollectionIndex]).toBe(secondDirPath);
    });
  });

  describe('listCollections()', () => {
    it('lists the open collections and closes those that fail to load', async () => {
      // Arrange
      await service.load(secondDirPath);
      const missingDirPath = path.join(USER_DATA_DIR, 'collections', 'missing');
      const settings = settingsService.modifiableSettings;
      settings.collections.push(missingDirPath);
      await settingsService.setSettings(settings);

      // Act
      const collections = await service.listCollections();

      // Assert
      expect(collections).toEqual([
        { id: 'first', title: 'first', dirPath: firstDirPath },
        { id: 'second', title: 'second', dirPath: secondDirPath },
      ]);
      expect(settingsService.settings.collections).not.toContain(missingDirPath);
    });
  });

  describe('dispatch()', () => {
    it('broadcasts patches that reproduce the model on a replica', async () => {
      // Arrange
      const replica = structuredClone(service.model);

      // Act
      await service.dispatch(
        envelope({ type: CommandType.RENAME, id: 'r1', title: 'renamed' }, 'a')
      );
      await service.dispatch(
        envelope(
          { type: CommandType.CREATE_REQUEST, request: request('r3', 'first', { draft: true }) },
          'b'
        )
      );
      await service.dispatch(
        envelope({ type: CommandType.MOVE, ids: ['r3'], parentId: 'first', index: 0 }, 'c')
      );

      // Assert
      let current = replica;
      for (const event of events) {
        if (event.kind !== 'patches') throw new Error('expected patches');
        current = applyPatches(current, event.patches);
      }
      expect(current).toEqual(service.model);
      expect(events.map((event) => event.kind === 'patches' && event.commandId)).toEqual([
        'a',
        'b',
        'c',
      ]);
    });

    it('increments the version with every command', async () => {
      // Arrange
      const { version } = service.model;

      // Act
      await service.apply({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'a' } });
      await service.apply({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'b' } });

      // Assert
      expect(service.model.version).toBe(version + 2);
      expect(events.map((event) => event.kind === 'patches' && event.version)).toEqual([
        version + 1,
        version + 2,
      ]);
    });

    it('rejects an invalid envelope without broadcasting', async () => {
      // Arrange
      const model = service.model;

      // Act & Assert
      await expect(
        service.dispatch({ commandId: 'x', command: { type: 'nope' } })
      ).rejects.toThrow();
      await expect(
        service.dispatch(envelope({ type: CommandType.DELETE, ids: ['does-not-exist'] }))
      ).rejects.toThrow();
      expect(events).toEqual([]);
      expect(service.model).toBe(model);
    });

    it('apply() changes the model before persisting and rejects an invalid command', async () => {
      // Act
      const persisted = service.apply({
        type: CommandType.UPDATE_COLLECTION,
        changes: { title: 'renamed' },
      });

      // Assert
      expect(service.model.collection.title).toBe('renamed');
      await expect(service.apply({ type: CommandType.DELETE, ids: ['missing'] })).rejects.toThrow();
      await persisted;
    });

    it('skips the delayed write of a request that was deleted meanwhile', async () => {
      // Arrange
      await service.apply({ type: CommandType.CREATE_DRAFT, id: 'r1' });
      await service.apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });

      // Act
      await service.apply({ type: CommandType.DELETE, ids: ['r1'] });
      await service.flush();

      // Assert
      expect(await exists(path.join(firstDirPath, 'r1'))).toBe(false);
    });

    it('writes structural changes before it resolves', async () => {
      // Act
      await service.apply({ type: CommandType.DELETE, ids: ['r1'] });

      // Assert
      expect(await exists(path.join(firstDirPath, 'r1'))).toBe(false);
    });

    it('writes edits of a draft delayed, or when flushed', async () => {
      // Arrange
      vi.useFakeTimers();
      await service.apply({ type: CommandType.EDIT_REQUEST, id: 'r1', changes: {} });

      // Act
      await service.apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });

      // Assert
      expect(await readRequestInfo('r1', DRAFT_DIR_NAME)).toMatchObject({ method: 'GET' });
      await service.flush();
      expect(await readRequestInfo('r1', DRAFT_DIR_NAME)).toMatchObject({ method: 'PUT' });

      // Act
      await service.apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.POST },
      });
      await vi.advanceTimersByTimeAsync(REQUEST_INFO_DEBOUNCE_MS);
      await service.flush();

      // Assert
      expect(await readRequestInfo('r1', DRAFT_DIR_NAME)).toMatchObject({ method: 'POST' });
    });

    it('saves the latest edits of a draft when it is saved', async () => {
      // Arrange
      await service.apply({ type: CommandType.SET_TEXT_BODY, id: 'r1', text: 'body' });
      await service.apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });

      // Act
      await service.apply({ type: CommandType.SAVE_REQUEST, id: 'r1' });
      await service.flush();

      // Assert
      expect(await exists(path.join(firstDirPath, 'r1', DRAFT_DIR_NAME))).toBe(false);
      expect(await readRequestInfo('r1')).toMatchObject({ method: 'PUT' });
      expect(await fs.readFile(path.join(firstDirPath, 'r1', TEXT_BODY_FILE_NAME), 'utf-8')).toBe(
        'body'
      );
    });

    it('does not write an info file again that creating or saving a draft wrote', async () => {
      // Arrange
      const saveRequestInfo = vi.spyOn(persistenceService, 'saveRequestInfo');

      // Act: the first edit creates the draft, which writes the info file of the edit
      await service.apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });
      await service.flush();

      // Assert
      expect(saveRequestInfo).not.toHaveBeenCalled();
      expect(await readRequestInfo('r1', DRAFT_DIR_NAME)).toMatchObject({ method: 'PUT' });

      // Act: saving writes the pending edit itself
      await service.apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.POST },
      });
      await service.apply({ type: CommandType.SAVE_REQUEST, id: 'r1' });
      await service.flush();

      // Assert
      expect(saveRequestInfo).toHaveBeenCalledOnce();
      expect(await readRequestInfo('r1')).toMatchObject({ method: 'POST' });
    });

    it('keeps the saved state when a draft with pending edits is discarded', async () => {
      // Arrange
      await service.apply({ type: CommandType.EDIT_REQUEST, id: 'r1', changes: {} });
      await service.apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });

      // Act
      await service.apply({ type: CommandType.DISCARD_REQUEST, id: 'r1' });
      await service.flush();

      // Assert
      expect(await exists(path.join(firstDirPath, 'r1', DRAFT_DIR_NAME))).toBe(false);
      expect(await readRequestInfo('r1')).toMatchObject({ method: 'GET' });
    });

    it('reloads the collection and broadcasts a snapshot if an effect fails', async () => {
      // Arrange
      const failure = new Error('disk full');
      vi.spyOn(persistenceService, 'rename').mockRejectedValueOnce(failure);

      // Act & Assert
      await expect(
        service.apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' })
      ).rejects.toBe(failure);
      expect(events.map((event) => event.kind)).toEqual(['patches', 'snapshot']);
      expect(service.model.requests.get('r1')?.title).toBe('r1');
    });

    it('reloads the collection if a delayed write fails', async () => {
      // Arrange
      await service.apply({ type: CommandType.EDIT_REQUEST, id: 'r1', changes: {} });
      await service.apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });
      vi.spyOn(persistenceService, 'saveRequestInfo').mockRejectedValueOnce(new Error('failed'));
      events.length = 0;

      // Act
      await service.flush();

      // Assert
      expect(events.map((event) => event.kind)).toEqual(['snapshot']);
      expect(service.model.requests.get('r1')?.method).toBe(RequestMethod.GET);
    });
  });

  describe('concurrency', () => {
    it('rejects commands while a collection is loaded', async () => {
      // Act
      const loading = service.load(secondDirPath);
      const dispatched = service.dispatch(
        envelope({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'renamed' } })
      );

      // Assert
      await expect(dispatched).rejects.toThrow('being loaded');
      await loading;
      expect(service.model.collection).toMatchObject({ id: 'second', title: 'second' });
      expect(events.map((event) => event.kind)).toEqual(['snapshot']);
    });

    it('accepts commands again once the load is done', async () => {
      // Arrange
      await service.load(secondDirPath);

      // Act
      await service.apply({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'renamed' } });

      // Assert
      expect(service.model.collection.title).toBe('renamed');
    });

    it('rejects commands while the collection is reloaded after a failure', async () => {
      // Arrange
      let reject!: (error: Error) => void;
      vi.spyOn(persistenceService, 'rename').mockReturnValueOnce(
        new Promise<void>((_, r) => (reject = r))
      );
      const failing = service.apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' });
      const loadCollection = persistenceService.loadCollection.bind(persistenceService);
      let dispatchedDuringReload: Promise<void> | undefined;
      vi.spyOn(persistenceService, 'loadCollection').mockImplementationOnce((...args) => {
        dispatchedDuringReload = service.dispatch(
          envelope({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'renamed' } })
        );
        return loadCollection(...args);
      });

      // Act
      reject(new Error('disk full'));

      // Assert
      await expect(failing).rejects.toThrow('disk full');
      await expect(dispatchedDuringReload).rejects.toThrow('being loaded');
      expect(service.model.collection.title).toBe('first');
    });

    it('skips effects that were queued before the collection was reloaded', async () => {
      // Arrange
      let reject!: (error: Error) => void;
      vi.spyOn(persistenceService, 'rename').mockReturnValueOnce(
        new Promise<void>((_, r) => (reject = r))
      );
      const failing = service.apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' });
      const stale = service.apply({
        type: CommandType.CREATE_FOLDER,
        folder: {
          id: 'f1',
          parentId: 'first',
          type: 'folder',
          lastModified: 0,
          title: 'folder',
        },
      });

      // Act
      reject(new Error('disk full'));

      // Assert
      await expect(failing).rejects.toThrow('disk full');
      await expect(stale).rejects.toThrow('reloaded');
      expect(await exists(path.join(firstDirPath, 'folder'))).toBe(false);
      expect(service.model.folders.has('f1')).toBe(false);
      expect(service.model.childIds.get('first')).not.toContain('f1');
    });

    it('writes the pending edits of other requests before reloading after a failure', async () => {
      // Arrange
      await service.apply({ type: CommandType.EDIT_REQUEST, id: 'r2', changes: {} });
      await service.apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r2',
        changes: { method: RequestMethod.PUT },
      });
      vi.spyOn(persistenceService, 'rename').mockRejectedValueOnce(new Error('disk full'));

      // Act
      await expect(
        service.apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' })
      ).rejects.toThrow('disk full');

      // Assert
      expect(service.model.requests.get('r2')?.method).toBe(RequestMethod.PUT);
      expect(await readRequestInfo('r2', DRAFT_DIR_NAME)).toMatchObject({ method: 'PUT' });
    });

    it('still reloads if writing a pending edit before the reload fails', async () => {
      // Arrange
      await service.apply({ type: CommandType.EDIT_REQUEST, id: 'r2', changes: {} });
      await service.apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r2',
        changes: { method: RequestMethod.PUT },
      });
      vi.spyOn(persistenceService, 'rename').mockRejectedValueOnce(new Error('disk full'));
      vi.spyOn(persistenceService, 'saveRequestInfo').mockRejectedValueOnce(new Error('failed'));
      events.length = 0;

      // Act
      await expect(
        service.apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' })
      ).rejects.toThrow('disk full');

      // Assert
      expect(events.map((event) => event.kind)).toEqual(['patches', 'snapshot']);
      expect(service.model.requests.get('r1')?.title).toBe('r1');
      expect(service.model.requests.get('r2')?.method).toBe(RequestMethod.GET);
    });

    it('loads collections one after another', async () => {
      // Arrange
      const loadCollection = persistenceService.loadCollection.bind(persistenceService);
      let release!: () => void;
      const released = new Promise<void>((r) => (release = r));
      vi.spyOn(persistenceService, 'loadCollection').mockImplementationOnce(async (...args) => {
        await released; // the first load is slower than the second one
        return loadCollection(...args);
      });

      // Act
      const first = service.load(secondDirPath);
      const second = service.load(firstDirPath);
      await new Promise((r) => setImmediate(r));
      release();
      await Promise.all([first, second]);

      // Assert
      expect(service.model.collection.id).toBe('first');
      const { settings } = settingsService;
      expect(settings.collections[settings.currentCollectionIndex]).toBe(firstDirPath);
      expect(events.map((event) => event.kind === 'snapshot' && event.model.collection.id)).toEqual(
        ['second', 'first']
      );
    });
  });

  describe('flush()', () => {
    it('waits for queued writes', async () => {
      // Arrange
      let resolve!: () => void;
      vi.spyOn(persistenceService, 'saveCollectionInfo').mockReturnValueOnce(
        new Promise<void>((r) => (resolve = r))
      );
      const dispatched = service.apply({
        type: CommandType.UPDATE_COLLECTION,
        changes: { title: 'renamed' },
      });
      const flushed = vi.fn();

      // Act
      const flushing = service.flush().then(flushed);
      await new Promise((r) => setImmediate(r));

      // Assert
      expect(flushed).not.toHaveBeenCalled();
      resolve();
      await Promise.all([dispatched, flushing]);
      expect(flushed).toHaveBeenCalled();
    });
  });

  describe('readRequest()', () => {
    it('waits for queued writes before it reads', async () => {
      // Arrange
      let resolve!: () => void;
      vi.spyOn(persistenceService, 'rename').mockReturnValueOnce(
        new Promise<void>((r) => (resolve = r))
      );
      const dispatched = service.apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' });
      const reader = vi.fn(async (request: TrufosRequest) => request.title);

      // Act
      const reading = service.readRequest('r1', reader);
      await new Promise((r) => setImmediate(r));

      // Assert
      expect(reader).not.toHaveBeenCalled();
      resolve();
      await dispatched;
      await expect(reading).resolves.toBe('renamed');
    });

    it('writes pending edits before it reads', async () => {
      // Arrange
      vi.useFakeTimers();
      await service.apply({ type: CommandType.EDIT_REQUEST, id: 'r1', changes: {} });
      await service.apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });

      // Act
      const result = await service.readRequest('r1', async (request) => ({
        info: await readRequestInfo('r1', DRAFT_DIR_NAME),
        method: request.method,
      }));

      // Assert
      const { info, method } = result!;
      expect(info).toMatchObject({ method: 'PUT' });
      expect(method).toBe(RequestMethod.PUT);
    });

    it('writes the effects of a command dispatched while reading only after the reader is done', async () => {
      // Arrange
      let finishReading!: () => void;
      const reading = service.readRequest(
        'r1',
        () => new Promise<void>((resolve) => (finishReading = resolve))
      );
      await vi.waitFor(() => expect(finishReading).toBeDefined());
      const saveCollectionInfo = vi.spyOn(persistenceService, 'saveCollectionInfo');

      // Act
      const dispatched = service.apply({
        type: CommandType.UPDATE_COLLECTION,
        changes: { title: 'renamed' },
      });
      await new Promise((r) => setImmediate(r));

      // Assert
      expect(service.model.collection.title).toBe('renamed');
      expect(saveCollectionInfo).not.toHaveBeenCalled();
      finishReading();
      await Promise.all([reading, dispatched]);
      expect(saveCollectionInfo).toHaveBeenCalled();
    });

    it('gets the request, or undefined if there is none', async () => {
      // Act
      const title = await service.readRequest('r1', async (request) => request.title);
      const missing = await service.readRequest('missing', async () => 'read');

      // Assert
      expect(title).toBe('r1');
      expect(missing).toBeUndefined();
    });

    it('prepareRequest() opens the files of the request, or fails if there is none', async () => {
      // Act
      const prepared = await service.prepareRequest('r1');
      prepared.textBody?.destroy();

      // Assert
      expect(prepared).toMatchObject({
        request: { id: 'r1' },
        collectionId: 'first',
        scripts: {},
      });
      await expect(service.prepareRequest('missing')).rejects.toThrow(
        'Request missing does not exist'
      );
    });

    it('rejects if the reader fails without affecting later writes', async () => {
      // Arrange
      const failure = new Error('read failed');

      // Act & Assert
      await expect(service.readRequest('r1', () => Promise.reject(failure))).rejects.toBe(failure);
      await service.apply({ type: CommandType.DELETE, ids: ['r1'] });

      // Assert
      expect(events.map((event) => event.kind)).toEqual(['patches']);
      expect(await exists(path.join(firstDirPath, 'r1'))).toBe(false);
    });
  });

  it('model objects are frozen', async () => {
    // Arrange
    await service.apply({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'renamed' } });
    const model: CollectionModel = service.model;

    // Assert
    expect(Object.isFrozen(model.collection)).toBe(true);
    expect(Object.isFrozen(model.requests.get('r1'))).toBe(true);
  });
});

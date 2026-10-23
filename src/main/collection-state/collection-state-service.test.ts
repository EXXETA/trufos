import path from 'node:path';
import fs from 'node:fs/promises';
import { applyPatches } from 'immer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exists, USER_DATA_DIR } from 'main/util/fs-util';
import { DRAFT_DIR_NAME } from 'main/persistence/constants';
import type { PersistenceService } from 'main/persistence/service/persistence-service';
import type { StateService } from 'main/persistence/service/state-service';
import {
  CollectionCommand,
  CollectionModel,
  CollectionStateEvent,
  CommandEnvelope,
  CommandType,
} from 'shim/collection-model';
import { Collection } from 'shim/objects/collection';
import { CollectionUiState } from 'shim/collection-ui-state';
import { TEXT_BODY_FILE_NAME, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { makeCollection, makeRequest } from 'shim/__mocks__/collection-fixtures';
import type {
  CollectionStateService,
  REQUEST_INFO_DEBOUNCE_MS as DebounceMs,
} from './collection-state-service';

const firstDirPath = path.join(USER_DATA_DIR, 'collections', 'first');
const secondDirPath = path.join(USER_DATA_DIR, 'collections', 'second');

let persistenceService: PersistenceService;
let stateService: StateService;
let DEFAULT_COLLECTION_DIR: string;
let service: CollectionStateService;
let createService: () => CollectionStateService;
let REQUEST_INFO_DEBOUNCE_MS: typeof DebounceMs;
let events: CollectionStateEvent[];

const request = makeRequest;

function collection(id: string, dirPath: string, requestIds: string[]): Collection {
  return makeCollection(
    id,
    requestIds.map((requestId) => request(requestId, id)),
    {
      title: id,
      dirPath,
      isDefault: false,
      environments: { dev: { variables: {} }, prod: { variables: {} } },
    }
  );
}

function envelope(command: CollectionCommand, commandId = 'cmd'): CommandEnvelope {
  return { commandId, timestamp: 1, command };
}

function apply(command: CollectionCommand): Promise<number> {
  return service.dispatch(envelope(command));
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
      StateService: { instance: stateService, DEFAULT_COLLECTION_DIR },
    } = await import('../persistence/service/state-service.js'));
    const module = await import('./collection-state-service.js');
    REQUEST_INFO_DEBOUNCE_MS = module.REQUEST_INFO_DEBOUNCE_MS;
    createService = () => new module.CollectionStateService();
    service = createService();

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
      expect(stateService.currentCollection).toBe(secondDirPath);
    });

    it('broadcasts the UI state stored for the collection with its snapshot', async () => {
      // Arrange
      const ui = CollectionUiState.parse({ selectedRequestId: 's1', openFolders: [] });
      await service.load(secondDirPath);
      await stateService.saveUiState(secondDirPath, ui);
      await service.load(firstDirPath);
      events.length = 0;

      // Act
      await service.load(secondDirPath);

      // Assert
      expect(events).toEqual([{ kind: 'snapshot', model: service.model, ui }]);
      expect(service.snapshot).toEqual({ model: service.model, ui });
    });

    it('loads the saved state of requests with a draft', async () => {
      // Arrange
      await apply({
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
      await apply({
        type: CommandType.UPDATE_COLLECTION,
        changes: {},
        selectedEnvironmentKey: 'prod',
      });

      // Act
      await service.load(firstDirPath);

      // Assert
      expect(service.model.selectedEnvironmentKey).toBe('prod');
    });

    it('selects the environment selected last when the collection is loaded again', async () => {
      // Arrange
      await apply({
        type: CommandType.UPDATE_COLLECTION,
        changes: {},
        selectedEnvironmentKey: 'prod',
      });
      await service.load(secondDirPath);
      expect(service.model.selectedEnvironmentKey).toBe('dev');

      // Act
      await service.load(firstDirPath);

      // Assert
      expect(service.model.selectedEnvironmentKey).toBe('prod');
    });

    it('selects the environment selected last after a restart', async () => {
      // Arrange
      await apply({
        type: CommandType.UPDATE_COLLECTION,
        changes: {},
        selectedEnvironmentKey: 'prod',
      });
      const { StateService } = await import('../persistence/service/state-service.js');
      const stateFile = JSON.parse(await fs.readFile(StateService.STATE_FILE, 'utf8'));
      expect(stateFile.collections).toContainEqual({
        dirPath: firstDirPath,
        selectedEnvironmentKey: 'prod',
      });

      // Act
      const restarted = createService();
      await restarted.init();

      // Assert
      expect(restarted.model.selectedEnvironmentKey).toBe('prod');
    });

    it('remembers that no environment is selected', async () => {
      // Arrange
      await apply({
        type: CommandType.UPDATE_COLLECTION,
        changes: {},
        selectedEnvironmentKey: null,
      });

      // Act
      await service.load(firstDirPath);

      // Assert
      expect(service.model.selectedEnvironmentKey).toBeUndefined();
    });

    it('falls back to the first environment if the stored one no longer exists', async () => {
      // Arrange
      await stateService.selectEnvironment(firstDirPath, 'gone');

      // Act
      await service.load(firstDirPath);

      // Assert
      expect(service.model.selectedEnvironmentKey).toBe('dev');
    });

    it('applies an environment selection that could not be stored', async () => {
      // Arrange
      vi.spyOn(stateService, 'selectEnvironment').mockRejectedValueOnce(new Error('state locked'));

      // Act
      await apply({
        type: CommandType.UPDATE_COLLECTION,
        changes: {},
        selectedEnvironmentKey: 'prod',
      });

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
      await apply({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'renamed' } });
      const { version } = service.model;

      // Act
      await service.load(secondDirPath);

      // Assert
      expect(service.model.version).toBeGreaterThan(version);
    });
  });

  describe('load() failure', () => {
    it('keeps the current collection if adding the new one to the app state fails', async () => {
      // Arrange
      vi.spyOn(stateService, 'open').mockRejectedValueOnce(new Error('state locked'));

      // Act & Assert
      await expect(service.load(secondDirPath)).rejects.toThrow('state locked');
      expect(service.model.collection.id).toBe('first');
      expect(events).toEqual([]);
      await apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' });
      expect(service.model.requests.get('r1')?.title).toBe('renamed');
    });
  });

  describe('closeCollection()', () => {
    it('loads the default collection when the current one is closed', async () => {
      // Arrange
      await persistenceService.createDefaultCollectionIfNotExists();

      // Act
      await service.closeCollection();

      // Assert
      expect(service.model.collection.dirPath).toBe(DEFAULT_COLLECTION_DIR);
      expect(stateService.openCollections).not.toContain(firstDirPath);
      expect(stateService.currentCollection).toBe(DEFAULT_COLLECTION_DIR);
    });

    it('keeps the default collection open', async () => {
      // Arrange
      await persistenceService.createDefaultCollectionIfNotExists();
      await service.load(DEFAULT_COLLECTION_DIR);
      await service.load(secondDirPath);

      // Act
      await service.closeCollection(DEFAULT_COLLECTION_DIR);

      // Assert
      expect(service.model.collection.id).toBe('second');
      expect(stateService.openCollections).toContain(DEFAULT_COLLECTION_DIR);
    });

    it('forgets the selected environment of the closed collection', async () => {
      // Arrange
      await apply({
        type: CommandType.UPDATE_COLLECTION,
        changes: {},
        selectedEnvironmentKey: 'prod',
      });
      await service.load(secondDirPath);

      // Act
      await service.closeCollection(firstDirPath);

      // Assert
      expect(stateService.openCollections).not.toContain(firstDirPath);
      await service.load(firstDirPath);
      expect(service.model.selectedEnvironmentKey).toBe('dev');
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
      expect(stateService.openCollections).not.toContain(firstDirPath);
      expect(stateService.currentCollection).toBe(secondDirPath);
    });
  });

  describe('listCollections()', () => {
    it('lists the open collections and closes those that fail to load', async () => {
      // Arrange
      await service.load(secondDirPath);
      const missingDirPath = path.join(USER_DATA_DIR, 'collections', 'missing');
      await stateService.open(missingDirPath);
      await stateService.open(secondDirPath);

      // Act
      const collections = await service.listCollections();

      // Assert
      expect(collections).toEqual([
        { id: 'first', title: 'first', dirPath: firstDirPath },
        { id: 'second', title: 'second', dirPath: secondDirPath },
      ]);
      expect(stateService.openCollections).not.toContain(missingDirPath);
    });

    it('does not change where the files of the current collection are written', async () => {
      // Arrange: another open collection has the same ID, e.g. an imported export of the current one
      await service.load(secondDirPath);
      const copyDirPath = path.join(USER_DATA_DIR, 'collections', 'copy');
      await fs.cp(secondDirPath, copyDirPath, { recursive: true });
      await stateService.open(copyDirPath);
      await stateService.open(secondDirPath);

      // Act
      await service.listCollections();
      await apply({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'updated' } });

      // Assert
      const readTitle = (dirPath: string) =>
        fs
          .readFile(path.join(dirPath, 'collection.json'), 'utf-8')
          .then((t) => JSON.parse(t).title);
      expect(await readTitle(secondDirPath)).toBe('updated');
      expect(await readTitle(copyDirPath)).toBe('second');
    });
  });

  describe('dispatch()', () => {
    it('resolves with the version the command was applied as', async () => {
      // Arrange
      const version = service.model.version;

      // Act & Assert
      await expect(apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' })).resolves.toBe(
        version + 1
      );
    });

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
      await apply({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'a' } });
      await apply({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'b' } });

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

    it('applyTo() plans a command from the model on the queue and applies it', async () => {
      // Arrange
      let resolve!: () => void;
      vi.spyOn(persistenceService, 'rename').mockReturnValueOnce(
        new Promise<void>((r) => (resolve = r))
      );
      const renaming = apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' });
      const plan = vi.fn((model: CollectionModel) => ({
        type: CommandType.UPDATE_COLLECTION as const,
        changes: { title: `${model.requests.get('r1')?.title} planned` },
      }));

      // Act
      const applying = service.applyTo('first', plan);
      await new Promise((r) => setImmediate(r));

      // Assert: the plan waits for the rename and sees its result
      expect(plan).not.toHaveBeenCalled();
      resolve();
      await renaming;
      const applied = await applying;
      expect(applied).toBe(service.model);
      expect(applied.collection.title).toBe('renamed planned');
    });

    it('applyTo() applies nothing if the plan returns nothing', async () => {
      // Arrange
      const model = service.model;

      // Act
      const applied = await service.applyTo('first', () => undefined);

      // Assert
      expect(applied).toBe(model);
      expect(events).toEqual([]);
    });

    it('applyTo() does not run the plan if another collection is open', async () => {
      // Arrange
      const plan = vi.fn(() => undefined);

      // Act & Assert
      await expect(service.applyTo('second', plan)).rejects.toMatchObject({
        name: 'CollectionChangedError',
      });
      expect(plan).not.toHaveBeenCalled();
    });

    it('skips the delayed write of a request that was deleted meanwhile', async () => {
      // Arrange
      await apply({ type: CommandType.CREATE_DRAFT, id: 'r1' });
      await apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });

      // Act
      await apply({ type: CommandType.DELETE, ids: ['r1'] });
      await service.flush();

      // Assert
      expect(await exists(path.join(firstDirPath, 'r1'))).toBe(false);
    });

    it('writes structural changes before it resolves', async () => {
      // Act
      await apply({ type: CommandType.DELETE, ids: ['r1'] });

      // Assert
      expect(await exists(path.join(firstDirPath, 'r1'))).toBe(false);
    });

    it('writes edits of a draft delayed, or when flushed', async () => {
      // Arrange
      vi.useFakeTimers();
      await apply({ type: CommandType.EDIT_REQUEST, id: 'r1', changes: {} });

      // Act
      await apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });

      // Assert
      expect(await readRequestInfo('r1', DRAFT_DIR_NAME)).toMatchObject({ method: 'GET' });
      await service.flush();
      expect(await readRequestInfo('r1', DRAFT_DIR_NAME)).toMatchObject({ method: 'PUT' });

      // Act
      await apply({
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
      await apply({ type: CommandType.SET_TEXT_BODY, id: 'r1', text: 'body' });
      await apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });

      // Act
      await apply({ type: CommandType.SAVE_REQUEST, id: 'r1' });
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
      await apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });
      await service.flush();

      // Assert
      expect(saveRequestInfo).not.toHaveBeenCalled();
      expect(await readRequestInfo('r1', DRAFT_DIR_NAME)).toMatchObject({ method: 'PUT' });

      // Act: saving writes the pending edit itself
      await apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.POST },
      });
      await apply({ type: CommandType.SAVE_REQUEST, id: 'r1' });
      await service.flush();

      // Assert
      expect(saveRequestInfo).toHaveBeenCalledOnce();
      expect(await readRequestInfo('r1')).toMatchObject({ method: 'POST' });
    });

    it('keeps the saved state when a draft with pending edits is discarded', async () => {
      // Arrange
      await apply({ type: CommandType.EDIT_REQUEST, id: 'r1', changes: {} });
      await apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });

      // Act
      await apply({ type: CommandType.DISCARD_REQUEST, id: 'r1' });
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
      await expect(apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' })).rejects.toBe(
        failure
      );
      expect(events.map((event) => event.kind)).toEqual(['patches', 'snapshot']);
      expect(service.model.requests.get('r1')?.title).toBe('r1');
    });

    it('retries a failed delayed write before reloading, so the edit survives', async () => {
      // Arrange
      await apply({ type: CommandType.EDIT_REQUEST, id: 'r1', changes: {} });
      await apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });
      vi.spyOn(persistenceService, 'saveRequestInfo').mockRejectedValueOnce(new Error('failed'));
      events.length = 0;

      // Act
      await expect(service.flush()).rejects.toThrow('failed');

      // Assert
      expect(events.map((event) => event.kind)).toEqual(['snapshot']);
      expect(service.model.requests.get('r1')?.method).toBe(RequestMethod.PUT);
      expect(await readRequestInfo('r1', DRAFT_DIR_NAME)).toMatchObject({ method: 'PUT' });
    });

    it('writes a request again if it is edited after its info file was written', async () => {
      // Arrange
      await apply({ type: CommandType.EDIT_REQUEST, id: 'r1', changes: {} });
      await apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });
      const saveRequestInfo = persistenceService.saveRequestInfo.bind(persistenceService);
      let finishWrite: (() => void) | undefined;
      vi.spyOn(persistenceService, 'saveRequestInfo').mockImplementationOnce(async (request) => {
        await new Promise<void>((resolve) => (finishWrite = resolve));
        await saveRequestInfo(request);
      });

      // Act: the request is edited while its first write is in progress, so the edit waits for it
      const firstWrite = service.flush();
      await vi.waitFor(() => expect(finishWrite).toBeDefined());
      void apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.POST },
      });
      finishWrite?.();
      await firstWrite;
      await service.flush();

      // Assert
      expect(await readRequestInfo('r1', DRAFT_DIR_NAME)).toMatchObject({ method: 'POST' });
    });
  });

  describe('concurrency', () => {
    it('rejects a command dispatched while another collection is loaded', async () => {
      // Act
      const loading = service.load(secondDirPath);
      const dispatched = service.dispatch(
        envelope({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'renamed' } })
      );

      // Assert
      await expect(dispatched).rejects.toMatchObject({ name: 'CollectionChangedError' });
      await loading;
      expect(service.model.collection).toMatchObject({ id: 'second', title: 'second' });
      expect(events.map((event) => event.kind)).toEqual(['snapshot']);
    });

    it('accepts commands again once the load is done', async () => {
      // Arrange
      await service.load(secondDirPath);

      // Act
      await apply({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'renamed' } });

      // Assert
      expect(service.model.collection.title).toBe('renamed');
    });

    it('applies a command dispatched during a reload after a failure to the reloaded model', async () => {
      // Arrange
      let reject!: (error: Error) => void;
      vi.spyOn(persistenceService, 'rename').mockReturnValueOnce(
        new Promise<void>((_, r) => (reject = r))
      );
      const failing = apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' });
      const loadCollection = persistenceService.loadCollection.bind(persistenceService);
      let dispatchedDuringReload: Promise<number> | undefined;
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
      await expect(dispatchedDuringReload).resolves.toBe(service.model.version);
      expect(service.model.collection.title).toBe('renamed');
      expect(service.model.requests.get('r1')?.title).toBe('r1');
      expect(events.map((event) => event.kind)).toEqual(['patches', 'snapshot', 'patches']);
    });

    it('applies a command queued behind a failed one to the reloaded model', async () => {
      // Arrange
      let reject!: (error: Error) => void;
      vi.spyOn(persistenceService, 'rename').mockReturnValueOnce(
        new Promise<void>((_, r) => (reject = r))
      );
      const failing = apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' });
      const queued = apply({
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
      await expect(queued).resolves.toBe(service.model.version);
      expect(service.model.requests.get('r1')?.title).toBe('r1');
      expect(service.model.folders.has('f1')).toBe(true);
      expect(service.model.childIds.get('first')).toContain('f1');
      expect(await exists(path.join(firstDirPath, 'folder'))).toBe(true);
    });

    it('keeps accepting commands if the reload after a failure fails as well', async () => {
      // Arrange
      vi.spyOn(persistenceService, 'rename').mockRejectedValueOnce(new Error('disk full'));
      vi.spyOn(persistenceService, 'loadCollection').mockRejectedValueOnce(new Error('unreadable'));

      // Act
      const failing = apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' });
      const queued = apply({
        type: CommandType.UPDATE_COLLECTION,
        changes: { title: 'again' },
      });

      // Assert: the model keeps the change that could not be written until a later reload
      await expect(failing).rejects.toThrow('disk full');
      await expect(queued).resolves.toBe(service.model.version);
      expect(service.model.requests.get('r1')?.title).toBe('renamed');
      expect(service.model.collection.title).toBe('again');
      expect(events.map((event) => event.kind)).toEqual(['patches', 'patches']);
    });

    it('writes the pending edits of other requests before reloading after a failure', async () => {
      // Arrange
      await apply({ type: CommandType.EDIT_REQUEST, id: 'r2', changes: {} });
      await apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r2',
        changes: { method: RequestMethod.PUT },
      });
      vi.spyOn(persistenceService, 'rename').mockRejectedValueOnce(new Error('disk full'));

      // Act
      await expect(apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' })).rejects.toThrow(
        'disk full'
      );

      // Assert
      expect(service.model.requests.get('r2')?.method).toBe(RequestMethod.PUT);
      expect(await readRequestInfo('r2', DRAFT_DIR_NAME)).toMatchObject({ method: 'PUT' });
    });

    it('still reloads if writing a pending edit before the reload fails', async () => {
      // Arrange
      await apply({ type: CommandType.EDIT_REQUEST, id: 'r2', changes: {} });
      await apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r2',
        changes: { method: RequestMethod.PUT },
      });
      vi.spyOn(persistenceService, 'rename').mockRejectedValueOnce(new Error('disk full'));
      vi.spyOn(persistenceService, 'saveRequestInfo').mockRejectedValueOnce(new Error('failed'));
      events.length = 0;

      // Act
      await expect(apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' })).rejects.toThrow(
        'disk full'
      );

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
      expect(stateService.currentCollection).toBe(firstDirPath);
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
      const dispatched = apply({
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

  describe('reloadIfChanged()', () => {
    const folder = {
      id: 'f1',
      parentId: 'first',
      type: 'folder',
      lastModified: 0,
      title: 'folder',
    } as const;

    it('does not reload if the files did not change', async () => {
      // Act
      const reloaded = await service.reloadIfChanged();

      // Assert
      expect(reloaded).toBe(false);
      expect(events).toEqual([]);
    });

    it('does not reload after the changes the app wrote itself', async () => {
      // Arrange
      await apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' });
      await apply({ type: CommandType.CREATE_FOLDER, folder });
      await apply({ type: CommandType.MOVE, ids: ['r2'], parentId: 'f1', index: 0 });
      await apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });
      await apply({
        type: CommandType.UPDATE_COLLECTION,
        changes: { title: 'retitled' },
        selectedEnvironmentKey: 'prod',
      });
      await service.flush();
      events.length = 0;

      // Act
      const reloaded = await service.reloadIfChanged();

      // Assert
      expect(reloaded).toBe(false);
      expect(events).toEqual([]);
    });

    it('writes pending edits before it compares, so they are kept', async () => {
      // Arrange
      await apply({
        type: CommandType.EDIT_REQUEST,
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });
      events.length = 0;

      // Act
      const reloaded = await service.reloadIfChanged();

      // Assert
      expect(reloaded).toBe(false);
      expect(await readRequestInfo('r1', DRAFT_DIR_NAME)).toMatchObject({ method: 'PUT' });
    });

    it('reloads and broadcasts a snapshot if a request was changed outside the app', async () => {
      // Arrange
      const filePath = path.join(firstDirPath, 'r1', 'request.json');
      const info = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      await fs.writeFile(filePath, JSON.stringify({ ...info, method: 'DELETE' }));
      const { version } = service.model;

      // Act
      const reloaded = await service.reloadIfChanged();

      // Assert
      expect(reloaded).toBe(true);
      expect(service.model.requests.get('r1')?.method).toBe(RequestMethod.DELETE);
      expect(service.model.version).toBeGreaterThan(version);
      expect(events).toEqual([{ kind: 'snapshot', model: service.model }]);
    });

    it('reloads if a folder was created outside the app', async () => {
      // Arrange
      const other = createService();
      await other.load(firstDirPath);
      await other.dispatch(envelope({ type: CommandType.CREATE_FOLDER, folder }));

      // Act
      const reloaded = await service.reloadIfChanged();

      // Assert
      expect(reloaded).toBe(true);
      expect(service.model.folders.get('f1')?.title).toBe('folder');
    });

    it('reloads if a request was deleted outside the app', async () => {
      // Arrange
      await fs.rm(path.join(firstDirPath, 'r2'), { recursive: true });

      // Act
      const reloaded = await service.reloadIfChanged();

      // Assert
      expect(reloaded).toBe(true);
      expect(service.model.requests.has('r2')).toBe(false);
    });

    it('keeps the model and rejects if the files cannot be read', async () => {
      // Arrange
      await fs.writeFile(path.join(firstDirPath, 'r1', 'request.json'), '<<<<<<< HEAD');
      const model = service.model;

      // Act & Assert
      await expect(service.reloadIfChanged()).rejects.toThrow();
      expect(service.model).toBe(model);
      expect(events).toEqual([]);
    });
  });

  describe('reload()', () => {
    it('reloads and broadcasts a snapshot even if nothing changed', async () => {
      // Act
      await service.reload();

      // Assert
      expect(events).toEqual([{ kind: 'snapshot', model: service.model }]);
      expect(service.model.collection.id).toBe('first');
    });
  });

  describe('readRequest()', () => {
    it('waits for queued writes before it reads', async () => {
      // Arrange
      let resolve!: () => void;
      vi.spyOn(persistenceService, 'rename').mockReturnValueOnce(
        new Promise<void>((r) => (resolve = r))
      );
      const dispatched = apply({ type: CommandType.RENAME, id: 'r1', title: 'renamed' });
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
      await apply({ type: CommandType.EDIT_REQUEST, id: 'r1', changes: {} });
      await apply({
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

    it('applies a command dispatched while reading only after the reader is done', async () => {
      // Arrange
      let finishReading!: () => void;
      const reading = service.readRequest(
        'r1',
        () => new Promise<void>((resolve) => (finishReading = resolve))
      );
      await vi.waitFor(() => expect(finishReading).toBeDefined());
      const saveCollectionInfo = vi.spyOn(persistenceService, 'saveCollectionInfo');

      // Act
      const dispatched = apply({
        type: CommandType.UPDATE_COLLECTION,
        changes: { title: 'renamed' },
      });
      await new Promise((r) => setImmediate(r));

      // Assert
      expect(service.model.collection.title).toBe('first');
      expect(saveCollectionInfo).not.toHaveBeenCalled();
      finishReading();
      await Promise.all([reading, dispatched]);
      expect(service.model.collection.title).toBe('renamed');
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
        model: service.model,
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
      await apply({ type: CommandType.DELETE, ids: ['r1'] });

      // Assert
      expect(events.map((event) => event.kind)).toEqual(['patches']);
      expect(await exists(path.join(firstDirPath, 'r1'))).toBe(false);
    });
  });

  it('model objects are frozen', async () => {
    // Arrange
    await apply({ type: CommandType.UPDATE_COLLECTION, changes: { title: 'renamed' } });
    const model: CollectionModel = service.model;

    // Assert
    expect(Object.isFrozen(model.collection)).toBe(true);
    expect(Object.isFrozen(model.requests.get('r1'))).toBe(true);
  });
});

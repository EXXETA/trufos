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
        type: 'editRequest',
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
      await service.apply({ type: 'selectEnvironment', key: 'prod' });

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
      await service.apply({ type: 'renameCollection', title: 'renamed' });
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
      await service.dispatch(envelope({ type: 'rename', id: 'r1', title: 'renamed' }, 'a'));
      await service.dispatch(
        envelope({ type: 'createRequest', request: request('r3', 'first', { draft: true }) }, 'b')
      );
      await service.dispatch(
        envelope({ type: 'move', id: 'r3', parentId: 'first', index: 0 }, 'c')
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
      await service.apply({ type: 'renameCollection', title: 'a' });
      await service.apply({ type: 'renameCollection', title: 'b' });

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
        service.dispatch(envelope({ type: 'delete', id: 'does-not-exist' }))
      ).rejects.toThrow();
      expect(events).toEqual([]);
      expect(service.model).toBe(model);
    });

    it('writes structural changes before it resolves', async () => {
      // Act
      await service.apply({ type: 'delete', id: 'r1' });

      // Assert
      expect(await exists(path.join(firstDirPath, 'r1'))).toBe(false);
    });

    it('writes edits of a draft debounced, or when flushed', async () => {
      // Arrange
      vi.useFakeTimers();
      await service.apply({ type: 'editRequest', id: 'r1', changes: {} });

      // Act
      await service.apply({
        type: 'editRequest',
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });

      // Assert
      expect(await readRequestInfo('r1', DRAFT_DIR_NAME)).toMatchObject({ method: 'GET' });
      await service.flush();
      expect(await readRequestInfo('r1', DRAFT_DIR_NAME)).toMatchObject({ method: 'PUT' });

      // Act
      await service.apply({
        type: 'editRequest',
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
      await service.apply({ type: 'setTextBody', id: 'r1', text: 'body' });
      await service.apply({
        type: 'editRequest',
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });

      // Act
      await service.apply({ type: 'saveRequest', id: 'r1' });
      await service.flush();

      // Assert
      expect(await exists(path.join(firstDirPath, 'r1', DRAFT_DIR_NAME))).toBe(false);
      expect(await readRequestInfo('r1')).toMatchObject({ method: 'PUT' });
      expect(await fs.readFile(path.join(firstDirPath, 'r1', TEXT_BODY_FILE_NAME), 'utf-8')).toBe(
        'body'
      );
    });

    it('drops pending edits of a draft when it is discarded', async () => {
      // Arrange
      await service.apply({ type: 'editRequest', id: 'r1', changes: {} });
      await service.apply({
        type: 'editRequest',
        id: 'r1',
        changes: { method: RequestMethod.PUT },
      });

      // Act
      await service.apply({ type: 'discardRequest', id: 'r1' });
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
      await expect(service.apply({ type: 'rename', id: 'r1', title: 'renamed' })).rejects.toBe(
        failure
      );
      expect(events.map((event) => event.kind)).toEqual(['patches', 'snapshot']);
      expect(service.model.requests.get('r1')?.title).toBe('r1');
    });

    it('reloads the collection if a debounced write fails', async () => {
      // Arrange
      await service.apply({ type: 'editRequest', id: 'r1', changes: {} });
      await service.apply({
        type: 'editRequest',
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

  describe('flush()', () => {
    it('waits for queued writes', async () => {
      // Arrange
      let resolve!: () => void;
      vi.spyOn(persistenceService, 'saveCollectionInfo').mockReturnValueOnce(
        new Promise<void>((r) => (resolve = r))
      );
      const dispatched = service.apply({ type: 'renameCollection', title: 'renamed' });
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

  it('model objects are frozen', async () => {
    // Arrange
    await service.apply({ type: 'renameCollection', title: 'renamed' });
    const model: CollectionModel = service.model;

    // Assert
    expect(Object.isFrozen(model.collection)).toBe(true);
    expect(Object.isFrozen(model.requests.get('r1'))).toBe(true);
  });
});

import path from 'node:path';
import fs from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exists, USER_DATA_DIR } from 'main/util/fs-util';
import type { PersistenceService as PersistenceServiceType } from 'main/persistence/service/persistence-service';
import { DRAFT_DIR_NAME, getScriptFileName, ORDER_FILE_NAME } from 'main/persistence/constants';
import {
  applyCommandTo,
  CollectionCommand,
  CollectionModel,
  CommandType,
  normalizeCollection,
} from 'shim/collection-model';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TEXT_BODY_FILE_NAME, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { parseUrl } from 'shim/objects/url';
import { ScriptType } from 'shim/scripting';
import type { getCommandEffects as getCommandEffectsType } from './command-effects';

// both are loaded fresh for every test, as the persistence service remembers the directories of
// the IDs, which are the same in every test
let persistenceService: PersistenceServiceType;
let getCommandEffects: typeof getCommandEffectsType;

const dirPath = path.join(USER_DATA_DIR, 'collections', 'command-effects');

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

function folder(id: string, parentId: string, children: Folder['children'] = []): Folder {
  return { id, parentId, type: 'folder', lastModified: 0, title: id, children };
}

/**
 * col
 * ├── f1
 * │   ├── r1
 * │   └── f2
 * │       └── r2
 * └── r3
 */
async function createModel(): Promise<CollectionModel> {
  const collection: Collection = {
    id: 'col',
    type: 'collection',
    title: 'Collection',
    dirPath,
    isDefault: false,
    lastModified: 0,
    variables: {},
    environments: {},
    children: [
      folder('f1', 'col', [request('r1', 'f1'), folder('f2', 'f1', [request('r2', 'f2')])]),
      request('r3', 'col'),
    ],
  };
  await persistenceService.saveCollection(collection, true);
  await persistenceService.saveOrder('col', ['f1', 'r3']);
  await persistenceService.saveOrder('f1', ['r1', 'f2']);
  return await reload();
}

/** Loads the collection from disk, the way the `CollectionStateService` does. */
async function reload(): Promise<CollectionModel> {
  const collection = await persistenceService.loadCollection(dirPath);
  const model = normalizeCollection(collection);
  for (const request of model.requests.values()) {
    if (!request.draft) continue;
    const saved = await persistenceService.loadSavedRequest(request.id, request.parentId);
    if (saved != null) model.savedRequests.set(request.id, saved);
  }
  return model;
}

/** Applies a command and runs every write of its effects, including the debounced ones. */
async function run(model: CollectionModel, command: CollectionCommand) {
  const next = applyCommandTo(model, { commandId: 'cmd', timestamp: 1, command });
  const effects = getCommandEffects(model, next, command);
  await effects.immediate?.();
  for (const id of effects.debounce ?? []) {
    await persistenceService.saveRequestInfo(next.requests.get(id)!);
  }
  return next;
}

function readText(...segments: string[]) {
  return fs.readFile(path.join(dirPath, ...segments), 'utf-8');
}

async function readJson(...segments: string[]): Promise<unknown> {
  return JSON.parse(await readText(...segments));
}

/** Returns the model without the parts that are not persisted or change on every load. */
function persisted(model: CollectionModel) {
  const strip = <T extends { lastModified: number }>(node: T) => ({ ...node, lastModified: 0 });
  return {
    collection: strip(model.collection),
    folders: new Map([...model.folders].map(([id, node]) => [id, strip(node)])),
    requests: new Map([...model.requests].map(([id, node]) => [id, strip(node)])),
    savedRequests: new Map([...model.savedRequests].map(([id, node]) => [id, strip(node)])),
    childIds: model.childIds,
  };
}

describe('getCommandEffects()', () => {
  let model: CollectionModel;

  beforeEach(async () => {
    vi.resetModules();
    ({
      PersistenceService: { instance: persistenceService },
    } = await import('../persistence/service/persistence-service.js'));
    ({ getCommandEffects } = await import('./command-effects.js'));
    model = await createModel();
  });

  it('createRequest writes the draft and the order of the parent, but no body', async () => {
    // Act
    const next = await run(model, {
      type: CommandType.CREATE_REQUEST,
      request: request('new', 'f1', { draft: true }),
      index: 0,
    });

    // Assert
    const draftDirPath = path.join(dirPath, 'f1', 'new', DRAFT_DIR_NAME);
    expect(await exists(path.join(draftDirPath, 'request.json'))).toBe(true);
    expect(await exists(path.join(draftDirPath, TEXT_BODY_FILE_NAME))).toBe(false);
    expect(await readJson('f1', ORDER_FILE_NAME)).toEqual(['new', 'r1', 'f2']);
    expect(persisted(await reload())).toEqual(persisted(next));
  });

  it('createFolder writes the folder and the order of the parent', async () => {
    // Act
    const next = await run(model, {
      type: CommandType.CREATE_FOLDER,
      folder: { id: 'nf', parentId: 'col', type: 'folder', lastModified: 0, title: 'New' },
    });

    // Assert
    expect(await exists(path.join(dirPath, 'new', 'folder.json'))).toBe(true);
    expect(await readJson(ORDER_FILE_NAME)).toEqual(['f1', 'r3', 'nf']);
    expect(persisted(await reload())).toEqual(persisted(next));
  });

  it('rename renames the directory and keeps the descendants reachable', async () => {
    // Act
    const next = await run(model, { type: CommandType.RENAME, id: 'f1', title: 'Renamed' });
    await run(next, { type: CommandType.SET_TEXT_BODY, id: 'r2', text: 'body' });

    // Assert
    expect(await exists(path.join(dirPath, 'f1'))).toBe(false);
    expect(await readText('renamed', 'f2', 'r2', DRAFT_DIR_NAME, TEXT_BODY_FILE_NAME)).toBe('body');
    expect((await reload()).folders.get('f1')?.title).toBe('Renamed');
  });

  it('move moves a folder whose descendants still resolve afterwards', async () => {
    // Act
    const next = await run(model, { type: CommandType.MOVE, id: 'f2', parentId: 'col', index: 0 });
    await run(next, { type: CommandType.SET_TEXT_BODY, id: 'r2', text: 'moved' });

    // Assert
    expect(await exists(path.join(dirPath, 'f1', 'f2'))).toBe(false);
    expect(await readText('f2', 'r2', DRAFT_DIR_NAME, TEXT_BODY_FILE_NAME)).toBe('moved');
    expect(await readJson(ORDER_FILE_NAME)).toEqual(['f2', 'f1', 'r3']);
    expect(await readJson('f1', ORDER_FILE_NAME)).toEqual(['r1']);
    expect(persisted(await reload()).childIds).toEqual(next.childIds);
  });

  it('move within the same parent only writes the new order', async () => {
    // Act
    const next = await run(model, { type: CommandType.MOVE, id: 'r3', parentId: 'col', index: 0 });

    // Assert
    expect(await readJson(ORDER_FILE_NAME)).toEqual(['r3', 'f1']);
    expect(persisted(await reload())).toEqual(persisted(next));
  });

  it('delete removes the directory and the ID from the order of the parent', async () => {
    // Act
    const next = await run(model, { type: CommandType.DELETE, id: 'f2' });

    // Assert
    expect(await exists(path.join(dirPath, 'f1', 'f2'))).toBe(false);
    expect(await readJson('f1', ORDER_FILE_NAME)).toEqual(['r1']);
    expect(persisted(await reload())).toEqual(persisted(next));
  });

  it('copy writes every copied node, parents first, with their bodies and scripts', async () => {
    // Arrange
    let current = await run(model, { type: CommandType.SET_TEXT_BODY, id: 'r2', text: 'body' });
    current = await run(current, { type: CommandType.SAVE_REQUEST, id: 'r2' });
    await persistenceService.saveScript(current.requests.get('r2')!, ScriptType.PRE_REQUEST, 'pre');

    // Act
    const next = await run(current, {
      type: CommandType.COPY,
      id: 'f1',
      idMap: { f1: 'c1', r1: 'cr1', f2: 'c2', r2: 'cr2' },
    });

    // Assert
    const copyDir = 'f1-copy';
    expect(await readText(copyDir, 'f2', 'r2', TEXT_BODY_FILE_NAME)).toBe('body');
    expect(await readText(copyDir, 'f2', 'r2', getScriptFileName(ScriptType.PRE_REQUEST))).toBe(
      'pre'
    );
    expect(await readJson(ORDER_FILE_NAME)).toEqual(['f1', 'r3', 'c1']);
    expect(await readJson(copyDir, ORDER_FILE_NAME)).toEqual(['cr1', 'c2']);
    expect(persisted(await reload())).toEqual(persisted(next));
  });

  it('copy of a draft request copies its draft state and files', async () => {
    // Arrange
    let current = await run(model, {
      type: CommandType.EDIT_REQUEST,
      id: 'r3',
      changes: { method: RequestMethod.POST },
    });
    current = await run(current, { type: CommandType.SET_TEXT_BODY, id: 'r3', text: 'draft body' });

    // Act
    const next = await run(current, { type: CommandType.COPY, id: 'r3', idMap: { r3: 'copy' } });

    // Assert
    expect(await readText('r3-copy', TEXT_BODY_FILE_NAME)).toBe('draft body');
    expect(await exists(path.join(dirPath, 'r3-copy', DRAFT_DIR_NAME))).toBe(false);
    const loaded = await reload();
    expect(loaded.requests.get('copy')).toMatchObject({
      method: RequestMethod.POST,
      draft: false,
    });
    expect(persisted(loaded)).toEqual(persisted(next));
  });

  it('editRequest creates the draft with the saved body and scripts on the first edit', async () => {
    // Arrange
    const saved = model.requests.get('r3')!;
    await persistenceService.writeTextBody(saved, 'saved body');
    await persistenceService.saveScript(saved, ScriptType.POST_RESPONSE, 'post');

    // Act
    const effects = getCommandEffects(
      model,
      applyCommandTo(model, {
        commandId: 'cmd',
        timestamp: 1,
        command: {
          type: CommandType.EDIT_REQUEST,
          id: 'r3',
          changes: { url: parseUrl('http://edited') },
        },
      }),
      { type: CommandType.EDIT_REQUEST, id: 'r3', changes: { url: parseUrl('http://edited') } }
    );
    await effects.immediate?.();

    // Assert
    expect(effects.debounce).toBeUndefined();
    expect(await readText('r3', DRAFT_DIR_NAME, TEXT_BODY_FILE_NAME)).toBe('saved body');
    expect(await readText('r3', DRAFT_DIR_NAME, getScriptFileName(ScriptType.POST_RESPONSE))).toBe(
      'post'
    );
    const loaded = await reload();
    expect(loaded.requests.get('r3')).toMatchObject({
      draft: true,
      url: { base: 'http://edited' },
    });
    expect(loaded.savedRequests.get('r3')).toMatchObject({ url: { base: 'http://example.com' } });
  });

  it('editRequest of a draft is debounced', async () => {
    // Arrange
    const draft = await run(model, { type: CommandType.EDIT_REQUEST, id: 'r3', changes: {} });
    const command: CollectionCommand = {
      type: CommandType.EDIT_REQUEST,
      id: 'r3',
      changes: { method: RequestMethod.PUT },
    };

    // Act
    const effects = getCommandEffects(
      draft,
      applyCommandTo(draft, { commandId: 'cmd', timestamp: 1, command }),
      command
    );

    // Assert
    expect(effects).toEqual({ debounce: ['r3'] });
  });

  it('setScript writes the script into the draft', async () => {
    // Act
    const next = await run(model, {
      type: CommandType.SET_SCRIPT,
      id: 'r1',
      scriptType: ScriptType.PRE_REQUEST,
      text: 'script',
    });

    // Assert
    expect(
      await readText('f1', 'r1', DRAFT_DIR_NAME, getScriptFileName(ScriptType.PRE_REQUEST))
    ).toBe('script');
    expect(persisted(await reload())).toEqual(persisted(next));
  });

  it('saveRequest turns the draft into the saved state', async () => {
    // Arrange: the last edit was debounced and not written yet
    let current = await run(model, {
      type: CommandType.SET_TEXT_BODY,
      id: 'r3',
      text: 'draft body',
    });
    current = applyCommandTo(current, {
      commandId: 'cmd',
      timestamp: 1,
      command: {
        type: CommandType.EDIT_REQUEST,
        id: 'r3',
        changes: { method: RequestMethod.DELETE },
      },
    });

    // Act
    const next = await run(current, { type: CommandType.SAVE_REQUEST, id: 'r3' });

    // Assert
    expect(await exists(path.join(dirPath, 'r3', DRAFT_DIR_NAME))).toBe(false);
    expect(await readText('r3', TEXT_BODY_FILE_NAME)).toBe('draft body');
    expect(persisted(await reload())).toEqual(persisted(next));
  });

  it('discardRequest restores the saved state', async () => {
    // Arrange
    const current = await run(model, {
      type: CommandType.EDIT_REQUEST,
      id: 'r3',
      changes: { method: RequestMethod.POST },
    });

    // Act
    const next = await run(current, { type: CommandType.DISCARD_REQUEST, id: 'r3' });

    // Assert
    expect(await exists(path.join(dirPath, 'r3', DRAFT_DIR_NAME))).toBe(false);
    expect(persisted(await reload())).toEqual(persisted(next));
  });

  it('discardRequest of a never saved request deletes it', async () => {
    // Arrange
    const current = await run(model, {
      type: CommandType.CREATE_REQUEST,
      request: request('new', 'col', { draft: true }),
    });

    // Act
    const next = await run(current, { type: CommandType.DISCARD_REQUEST, id: 'new' });

    // Assert
    expect(await exists(path.join(dirPath, 'new'))).toBe(false);
    expect(await readJson(ORDER_FILE_NAME)).toEqual(['f1', 'r3']);
    expect(persisted(await reload())).toEqual(persisted(next));
  });

  it('updateCollection writes the collection info file', async () => {
    // Act
    let next = await run(model, {
      type: CommandType.UPDATE_COLLECTION,
      changes: { title: 'Renamed', variables: { secret: { value: 'v', secret: true } } },
    });
    next = await run(next, {
      type: CommandType.UPDATE_COLLECTION,
      changes: { environments: { dev: { variables: { a: { value: 'b' } } } } },
    });

    // Assert
    const loaded = await reload();
    expect(loaded.collection).toMatchObject({
      title: 'Renamed',
      variables: { secret: { value: 'v', secret: true } },
      environments: { dev: { variables: { a: { value: 'b' } } } },
    });
    expect(persisted(loaded)).toEqual(persisted({ ...next, selectedEnvironmentKey: undefined }));
  });

  it('selectEnvironment persists nothing', async () => {
    // Arrange
    const current = await run(model, {
      type: CommandType.UPDATE_COLLECTION,
      changes: { environments: { dev: { variables: {} }, prod: { variables: {} } } },
    });
    const command: CollectionCommand = { type: CommandType.SELECT_ENVIRONMENT, key: 'prod' };

    // Act
    const effects = getCommandEffects(
      current,
      applyCommandTo(current, { commandId: 'cmd', timestamp: 1, command }),
      command
    );

    // Assert
    expect(effects).toEqual({});
  });
});

import { describe, expect, it } from 'vitest';
import { applyPatches, produceWithPatches } from 'immer';
import { RequestMethod } from '../objects/request-method';
import { AuthorizationType } from '../objects/auth';
import { applyCommand, applyCommandTo } from './apply-command';
import { CollectionCommand, CommandError, CommandType } from './commands';
import { CollectionModel } from './model';
import { makeModel, makeRequest } from '../__mocks__/collection-fixtures';

const TIMESTAMP = 1_000;

const request = makeRequest;

function createModel(): CollectionModel {
  return makeModel({
    title: 'Collection',
    environments: { dev: { variables: {} }, prod: { variables: {} } },
  });
}

function apply(model: CollectionModel, command: CollectionCommand) {
  return applyCommandTo(model, { commandId: 'cmd', timestamp: TIMESTAMP, command });
}

describe('normalizeCollection', () => {
  it('stores order and nesting only in childIds', () => {
    const model = createModel();
    expect(model.childIds.get('col')).toEqual(['f1', 'r3']);
    expect(model.childIds.get('f1')).toEqual(['r1', 'f2']);
    expect(model.childIds.get('f2')).toEqual(['r2']);
    expect(model.folders.get('f1')).not.toHaveProperty('children');
    expect(model.collection).not.toHaveProperty('children');
    expect([...model.requests.keys()].sort()).toEqual(['r1', 'r2', 'r3']);
  });

  it('selects the first environment if none is given', () => {
    expect(createModel().selectedEnvironmentKey).toBe('dev');
  });
});

describe('applyCommand', () => {
  it('creates a request at the given index', () => {
    const model = apply(createModel(), {
      type: CommandType.CREATE_REQUEST,
      request: request('new', 'f1', { draft: true }),
      index: 1,
    });
    expect(model.childIds.get('f1')).toEqual(['r1', 'new', 'f2']);
    expect(model.requests.get('new')).toMatchObject({ draft: true, lastModified: TIMESTAMP });
  });

  it('creates a folder at the end by default', () => {
    const model = apply(createModel(), {
      type: CommandType.CREATE_FOLDER,
      folder: { id: 'f3', parentId: 'col', type: 'folder', lastModified: 0, title: 'f3' },
    });
    expect(model.childIds.get('col')).toEqual(['f1', 'r3', 'f3']);
    expect(model.childIds.get('f3')).toEqual([]);
  });

  it('rejects duplicate IDs and missing parents', () => {
    expect(() =>
      apply(createModel(), { type: CommandType.CREATE_REQUEST, request: request('r1', 'col') })
    ).toThrow(CommandError);
    expect(() =>
      apply(createModel(), { type: CommandType.CREATE_REQUEST, request: request('x', 'missing') })
    ).toThrow(CommandError);
  });

  it('renames a request and its saved state', () => {
    let model = apply(createModel(), { type: CommandType.CREATE_DRAFT, id: 'r1' });
    model = apply(model, { type: CommandType.RENAME, id: 'r1', title: 'renamed' });
    expect(model.requests.get('r1')!.title).toBe('renamed');
    expect(model.savedRequests.get('r1')!.title).toBe('renamed');
  });

  it('reorders within the same parent', () => {
    const model = apply(createModel(), {
      type: CommandType.MOVE,
      ids: ['r1'],
      parentId: 'f1',
      index: 1,
    });
    expect(model.childIds.get('f1')).toEqual(['f2', 'r1']);
  });

  it('moves to another parent and updates parentId', () => {
    const model = apply(createModel(), {
      type: CommandType.MOVE,
      ids: ['r1'],
      parentId: 'col',
      index: 0,
    });
    expect(model.childIds.get('f1')).toEqual(['f2']);
    expect(model.childIds.get('col')).toEqual(['r1', 'f1', 'r3']);
    expect(model.requests.get('r1')!.parentId).toBe('col');
  });

  it('rejects moving a folder into itself or a descendant', () => {
    expect(() =>
      apply(createModel(), { type: CommandType.MOVE, ids: ['f1'], parentId: 'f2', index: 0 })
    ).toThrow(CommandError);
    expect(() =>
      apply(createModel(), { type: CommandType.MOVE, ids: ['f1'], parentId: 'f1', index: 0 })
    ).toThrow(CommandError);
  });

  it('moves several items in the given order, indexed without the moved items', () => {
    const model = apply(createModel(), {
      type: CommandType.MOVE,
      ids: ['r3', 'r1'],
      parentId: 'col',
      index: 0,
    });
    expect(model.childIds.get('col')).toEqual(['r3', 'r1', 'f1']);
    expect(model.childIds.get('f1')).toEqual(['f2']);
    expect(model.requests.get('r1')!.parentId).toBe('col');
  });

  it('rejects bulk commands with nested or repeated items without changing anything', () => {
    for (const command of [
      { type: CommandType.DELETE, ids: ['f1', 'r1'] },
      { type: CommandType.DELETE, ids: ['r3', 'r3'] },
      { type: CommandType.MOVE, ids: ['f2', 'r2'], parentId: 'col', index: 0 },
      { type: CommandType.COPY, ids: ['f1', 'f2'], idMap: { f1: 'a', r1: 'b', f2: 'c', r2: 'd' } },
    ] satisfies CollectionCommand[]) {
      expect(() => apply(createModel(), command)).toThrow(CommandError);
    }
  });

  it('deletes several items at once', () => {
    const model = apply(createModel(), { type: CommandType.DELETE, ids: ['f2', 'r3'] });
    expect(model.childIds.get('col')).toEqual(['f1']);
    expect(model.childIds.get('f1')).toEqual(['r1']);
    expect([...model.requests.keys()]).toEqual(['r1']);
  });

  it('copies several items, each to the end of its parent', () => {
    const model = apply(createModel(), {
      type: CommandType.COPY,
      ids: ['r1', 'r3'],
      idMap: { r1: 'c1', r3: 'c3' },
    });
    expect(model.childIds.get('f1')).toEqual(['r1', 'f2', 'c1']);
    expect(model.childIds.get('col')).toEqual(['f1', 'r3', 'c3']);
  });

  it('deletes a folder with all descendants', () => {
    const model = apply(createModel(), { type: CommandType.DELETE, ids: ['f1'] });
    expect(model.childIds.get('col')).toEqual(['r3']);
    expect(model.folders.size).toBe(0);
    expect([...model.requests.keys()]).toEqual(['r3']);
    expect(model.childIds.has('f2')).toBe(false);
  });

  it('copies a folder with all descendants to the end of its parent', () => {
    const model = apply(createModel(), {
      type: CommandType.COPY,
      ids: ['f1'],
      idMap: { f1: 'c1', r1: 'cr1', f2: 'c2', r2: 'cr2' },
    });
    expect(model.childIds.get('col')).toEqual(['f1', 'r3', 'c1']);
    expect(model.childIds.get('c1')).toEqual(['cr1', 'c2']);
    expect(model.childIds.get('c2')).toEqual(['cr2']);
    expect(model.folders.get('c1')!.title).toBe('f1 (Copy)');
    expect(model.folders.get('c2')!.title).toBe('f2');
    expect(model.requests.get('cr2')).toMatchObject({ parentId: 'c2', draft: false });
  });

  it('copies the draft of a request as the saved state of the copy', () => {
    let model = apply(createModel(), {
      type: CommandType.EDIT_REQUEST,
      id: 'r3',
      changes: { method: RequestMethod.POST },
    });
    model = apply(model, { type: CommandType.COPY, ids: ['r3'], idMap: { r3: 'c3' } });
    expect(model.requests.get('c3')).toMatchObject({ method: RequestMethod.POST, draft: false });
    expect(model.savedRequests.has('c3')).toBe(false);
  });

  it('rejects a copy with missing IDs', () => {
    expect(() =>
      apply(createModel(), { type: CommandType.COPY, ids: ['f1'], idMap: { f1: 'c1' } })
    ).toThrow(CommandError);
  });

  it('creates a draft on the first edit and keeps the saved state', () => {
    const model = apply(createModel(), {
      type: CommandType.EDIT_REQUEST,
      id: 'r1',
      changes: { method: RequestMethod.PUT },
    });
    expect(model.requests.get('r1')).toMatchObject({
      method: RequestMethod.PUT,
      draft: true,
      lastModified: TIMESTAMP,
    });
    expect(model.savedRequests.get('r1')).toMatchObject({
      method: RequestMethod.GET,
      draft: false,
    });
  });

  it('keeps the first saved state on further edits', () => {
    let model = apply(createModel(), {
      type: CommandType.EDIT_REQUEST,
      id: 'r1',
      changes: { method: RequestMethod.PUT },
    });
    model = apply(model, {
      type: CommandType.EDIT_REQUEST,
      id: 'r1',
      changes: { method: RequestMethod.POST },
    });
    expect(model.savedRequests.get('r1')!.method).toBe(RequestMethod.GET);
  });

  it('sets and removes the authorization of a request', () => {
    let model = apply(createModel(), {
      type: CommandType.EDIT_REQUEST,
      id: 'r1',
      changes: { auth: { type: AuthorizationType.BEARER, token: 't' } },
    });
    expect(model.requests.get('r1')!.auth).toEqual({ type: AuthorizationType.BEARER, token: 't' });
    model = apply(model, { type: CommandType.EDIT_REQUEST, id: 'r1', changes: { auth: null } });
    expect(model.requests.get('r1')).not.toHaveProperty('auth');
  });

  it('creates a draft without changing the request', () => {
    const model = apply(createModel(), { type: CommandType.CREATE_DRAFT, id: 'r1' });
    expect(model.requests.get('r1')).toMatchObject({ draft: true, method: RequestMethod.GET });
    expect(model.savedRequests.get('r1')).toMatchObject({ draft: false });
  });

  it('marks a request as draft when its body or script changes', () => {
    const model = apply(createModel(), { type: CommandType.SET_TEXT_BODY, id: 'r1', text: 'body' });
    expect(model.requests.get('r1')!.draft).toBe(true);
    expect(model.savedRequests.has('r1')).toBe(true);
  });

  it('saves a draft', () => {
    let model = apply(createModel(), {
      type: CommandType.EDIT_REQUEST,
      id: 'r1',
      changes: { method: RequestMethod.PUT },
    });
    model = apply(model, { type: CommandType.SAVE_REQUEST, id: 'r1' });
    expect(model.requests.get('r1')).toMatchObject({ method: RequestMethod.PUT, draft: false });
    expect(model.savedRequests.has('r1')).toBe(false);
  });

  it('discards a draft by restoring the saved state', () => {
    let model = apply(createModel(), {
      type: CommandType.EDIT_REQUEST,
      id: 'r1',
      changes: { method: RequestMethod.PUT },
    });
    model = apply(model, { type: CommandType.DISCARD_REQUEST, id: 'r1' });
    expect(model.requests.get('r1')).toMatchObject({ method: RequestMethod.GET, draft: false });
    expect(model.savedRequests.has('r1')).toBe(false);
  });

  it('deletes a never saved request when discarding it', () => {
    let model = apply(createModel(), {
      type: CommandType.CREATE_REQUEST,
      request: request('new', 'col', { draft: true }),
    });
    model = apply(model, { type: CommandType.DISCARD_REQUEST, id: 'new' });
    expect(model.requests.has('new')).toBe(false);
    expect(model.childIds.get('col')).toEqual(['f1', 'r3']);
  });

  it('keeps the environment selection valid when environments change', () => {
    let model = apply(createModel(), {
      type: CommandType.UPDATE_COLLECTION,
      changes: {},
      selectedEnvironmentKey: 'prod',
    });
    expect(model.selectedEnvironmentKey).toBe('prod');
    model = apply(model, {
      type: CommandType.UPDATE_COLLECTION,
      changes: { environments: { dev: { variables: {} } } },
    });
    expect(model.selectedEnvironmentKey).toBe('dev');
    expect(() =>
      apply(model, {
        type: CommandType.UPDATE_COLLECTION,
        changes: {},
        selectedEnvironmentKey: 'missing',
      })
    ).toThrow(CommandError);
  });

  it('keeps no environment selected when the collection changes', () => {
    let model = apply(createModel(), {
      type: CommandType.UPDATE_COLLECTION,
      changes: {},
      selectedEnvironmentKey: null,
    });
    model = apply(model, {
      type: CommandType.UPDATE_COLLECTION,
      changes: { variables: { a: { value: '1' } } },
    });
    expect(model.selectedEnvironmentKey).toBeUndefined();
  });

  it('selects an environment created by the same update', () => {
    let model = apply(createModel(), {
      type: CommandType.UPDATE_COLLECTION,
      changes: { environments: { staging: { variables: {} } } },
      selectedEnvironmentKey: 'staging',
    });
    expect(model.selectedEnvironmentKey).toBe('staging');
    model = apply(model, {
      type: CommandType.UPDATE_COLLECTION,
      changes: {},
      selectedEnvironmentKey: null,
    });
    expect(model.selectedEnvironmentKey).toBeUndefined();
    expect(() =>
      apply(model, {
        type: CommandType.UPDATE_COLLECTION,
        changes: {},
        selectedEnvironmentKey: 'missing',
      })
    ).toThrow(CommandError);
  });

  it('changes only the given collection settings', () => {
    let model = apply(createModel(), {
      type: CommandType.UPDATE_COLLECTION,
      changes: {
        title: 'New',
        clientCertificate: { certPath: '/cert.pem' },
        auth: { type: AuthorizationType.BEARER, token: 't' },
      },
    });
    model = apply(model, {
      type: CommandType.UPDATE_COLLECTION,
      changes: { variables: { a: { value: '1' } } },
    });
    expect(model.collection).toMatchObject({
      title: 'New',
      clientCertificate: { certPath: '/cert.pem' },
      auth: { type: AuthorizationType.BEARER, token: 't' },
      variables: { a: { value: '1' } },
    });
    expect(model.selectedEnvironmentKey).toBe('dev');
  });

  it('removes the client certificate and the authorization of the collection', () => {
    let model = apply(createModel(), {
      type: CommandType.UPDATE_COLLECTION,
      changes: {
        clientCertificate: { certPath: '/cert.pem' },
        auth: { type: AuthorizationType.BEARER, token: 't' },
      },
    });
    model = apply(model, {
      type: CommandType.UPDATE_COLLECTION,
      changes: { clientCertificate: null, auth: null },
    });
    expect(model.collection).not.toHaveProperty('clientCertificate');
    expect(model.collection).not.toHaveProperty('auth');
  });

  it('sets and removes the authorization of a folder', () => {
    let model = apply(createModel(), {
      type: CommandType.UPDATE_FOLDER,
      id: 'f1',
      changes: { auth: { type: AuthorizationType.BEARER, token: 't' } },
    });
    expect(model.folders.get('f1')).toMatchObject({
      auth: { type: AuthorizationType.BEARER, token: 't' },
      lastModified: TIMESTAMP,
    });

    model = apply(model, { type: CommandType.UPDATE_FOLDER, id: 'f1', changes: { auth: null } });
    expect(model.folders.get('f1')).not.toHaveProperty('auth');
  });

  it('rejects updating a folder that does not exist', () => {
    expect(() =>
      apply(createModel(), { type: CommandType.UPDATE_FOLDER, id: 'r1', changes: {} })
    ).toThrow(CommandError);
  });

  it('produces patches that reproduce the change on a replica', () => {
    const source = createModel();
    const replica = structuredClone(source);
    const [next, patches] = produceWithPatches(source, (draft) =>
      applyCommand(draft, {
        commandId: 'cmd',
        timestamp: TIMESTAMP,
        command: { type: CommandType.MOVE, ids: ['r2'], parentId: 'col', index: 0 },
      })
    );
    // patches are sent over IPC, which uses the structured clone algorithm
    expect(applyPatches(replica, structuredClone(patches))).toEqual(next);
  });
});

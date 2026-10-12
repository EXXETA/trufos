import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCollectionStore, createModelPersistence } from './collectionStore';
import { CollectionReplica } from './collection-replica';
import {
  FakeCollectionMain,
  makeCollection,
  makeFolder,
  makeRequest,
} from '@/__mocks__/fake-collection-main';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { IpcPushStream } from '@/lib/ipc-stream';
import { cancelModelEdits, flushModelEdits } from '@/lib/monaco/models';
import { CollectionCommand, normalizeCollection } from 'shim/collection-model';
import { Collection } from 'shim/objects/collection';
import { AuthorizationType, OAuth2Method } from 'shim/objects/auth';
import { RequestBodyType } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { ScriptType } from 'shim/scripting';

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      openCollection: vi.fn().mockResolvedValue(undefined),
      closeCollection: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: { open: vi.fn() },
}));

vi.mock('@/error/errorHandler', () => ({
  showError: vi.fn(),
}));

vi.mock('@/lib/monaco/models', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/monaco/models')>();
  return {
    ...actual,
    cancelModelEdits: vi.fn(actual.cancelModelEdits),
    flushModelEdits: vi.fn(actual.flushModelEdits),
  };
});

const eventService = vi.mocked(RendererEventService.instance);

const COL_ID = 'col';

/**
 * col
 * ├── F
 * │   ├── r1
 * │   └── G
 * │       └── r2
 * └── r3
 */
const defaultCollection = () =>
  makeCollection(COL_ID, [
    makeFolder('F', COL_ID, [
      makeRequest('r1', 'F'),
      makeFolder('G', 'F', [makeRequest('r2', 'G')]),
    ]),
    makeRequest('r3', COL_ID),
  ]);

const setup = (collection: Collection = defaultCollection(), savedRequests = []) => {
  const main = new FakeCollectionMain(normalizeCollection(collection, savedRequests));
  const replica = new CollectionReplica(
    structuredClone(main.model),
    main.dispatch,
    main.getCollectionState
  );
  main.onEvent((event) => replica.receive(event));
  const store = createCollectionStore(replica);
  const commands = (): CollectionCommand[] => main.received.map(({ command }) => command);
  return { main, replica, store, commands };
};

type Setup = ReturnType<typeof setup>;

const childIds = ({ store }: Setup, parentId: string) => store.getState().childIds.get(parentId);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('request edits', () => {
  let ctx: Setup;

  beforeEach(() => {
    ctx = setup();
    ctx.store.getState().setSelectedRequest('r3');
  });

  const request = () => ctx.store.getState().requests.get('r3')!;

  it('updateRequest changes the selected request and makes it a draft', () => {
    ctx.store.getState().updateRequest({ method: RequestMethod.POST });

    expect(ctx.commands()).toEqual([
      { type: 'editRequest', id: 'r3', changes: { method: RequestMethod.POST } },
    ]);
    expect(request().method).toBe(RequestMethod.POST);
    expect(request().draft).toBe(true);
    expect(ctx.store.getState().savedRequests.get('r3')!.method).toBe(RequestMethod.GET);
  });

  it('keeps unchanged requests and folders when a request changes', () => {
    const before = ctx.store.getState();

    ctx.store.getState().updateRequest({ method: RequestMethod.POST });

    const after = ctx.store.getState();
    expect(after.requests.get('r1')).toBe(before.requests.get('r1'));
    expect(after.folders).toBe(before.folders);
    expect(after.childIds).toBe(before.childIds);
    expect(after.openFolders).toBe(before.openFolders);
  });

  it('header actions send the complete new header list', () => {
    const { addHeader, updateHeader, deleteHeader, clearHeaders } = ctx.store.getState();

    addHeader();
    updateHeader(0, { key: 'X-Test', value: '1' });
    addHeader();
    deleteHeader(1);
    expect(request().headers).toEqual([{ key: 'X-Test', value: '1', isActive: true }]);

    clearHeaders();
    expect(request().headers).toEqual([]);
    expect(ctx.commands().every((command) => command.type === 'editRequest')).toBe(true);
  });

  it('query param actions send the complete new url', () => {
    const { addQueryParam, updateQueryParam, setQueryParamActive, deleteQueryParam } =
      ctx.store.getState();

    addQueryParam();
    updateQueryParam(0, { key: 'q', value: 'x' });
    setQueryParamActive(0);
    expect(request().url).toEqual({
      base: 'http://localhost',
      query: [{ key: 'q', value: 'x', isActive: false }],
    });

    deleteQueryParam(0);
    expect(ctx.commands().at(-1)).toEqual({
      type: 'editRequest',
      id: 'r3',
      changes: { url: { base: 'http://localhost', query: [] } },
    });
  });

  it('setRequestBodyMimeType changes the mime type of a text body', () => {
    ctx.store.getState().setRequestBodyMimeType('application/json');

    expect(request().body).toEqual({ type: RequestBodyType.TEXT, mimeType: 'application/json' });
  });

  describe('form data', () => {
    beforeEach(() => {
      ctx.store.getState().setRequestBody({ type: RequestBodyType.FORM_DATA, fields: [] });
    });

    const fields = () => {
      const { body } = request();
      return body.type === RequestBodyType.FORM_DATA ? body.fields : undefined;
    };

    it('adds, updates and deletes fields', () => {
      const { addFormDataField, updateFormDataField, deleteFormDataField } = ctx.store.getState();

      addFormDataField();
      addFormDataField();
      expect(fields()).toEqual([
        { key: '', isActive: true, value: { type: RequestBodyType.TEXT, mimeType: 'text/plain' } },
        { key: '', isActive: true, value: { type: RequestBodyType.TEXT, mimeType: 'text/plain' } },
      ]);

      updateFormDataField(1, { key: 'file', value: { type: RequestBodyType.FILE } });
      deleteFormDataField(0);
      expect(fields()).toEqual([
        { key: 'file', isActive: true, value: { type: RequestBodyType.FILE } },
      ]);
      expect(request().draft).toBe(true);
    });

    it('ignores form data actions for other body types', () => {
      ctx.store.getState().setRequestBody({ type: RequestBodyType.FILE });
      const count = ctx.commands().length;

      ctx.store.getState().addFormDataField();

      expect(ctx.commands()).toHaveLength(count);
    });
  });
});

describe('updateAuthorization', () => {
  let ctx: Setup;
  const auth = () => ctx.store.getState().requests.get('r3')!.auth;
  const update: (typeof ctx.store extends { getState(): infer S }
    ? S
    : never)['updateAuthorization'] = (request, fields) =>
    ctx.store.getState().updateAuthorization(request, fields);
  const r3 = () => ctx.store.getState().requests.get('r3')!;

  beforeEach(() => {
    ctx = setup();
  });

  it('creates a complete default when the type changes', () => {
    update(r3(), { type: AuthorizationType.OAUTH2 });

    expect(auth()).toMatchObject({
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.CLIENT_CREDENTIALS,
      clientId: '',
      clientSecret: '',
      scope: '',
    });
    expect(r3().draft).toBe(true);
  });

  it('merges fields when the type is unchanged', () => {
    update(r3(), { type: AuthorizationType.BASIC });
    update(r3(), { username: 'user' });

    expect(auth()).toEqual({ type: AuthorizationType.BASIC, username: 'user', password: '' });
  });

  it('drops the fields of the previous type', () => {
    update(r3(), { type: AuthorizationType.BEARER });
    update(r3(), { token: 'secret' });
    update(r3(), { type: AuthorizationType.BASIC });

    expect(auth()).toEqual({ type: AuthorizationType.BASIC, username: '', password: '' });
  });

  it('keeps the shared fields when the OAuth method changes', () => {
    update(r3(), { type: AuthorizationType.OAUTH2 });
    update(r3(), { clientId: 'client' });
    update(r3(), { method: OAuth2Method.AUTHORIZATION_CODE });

    expect(auth()).toMatchObject({
      method: OAuth2Method.AUTHORIZATION_CODE,
      clientId: 'client',
      authorizationUrl: '',
      callbackUrl: '',
      cache: true,
    });
  });

  it('removes the authorization when called with null', () => {
    update(r3(), { type: AuthorizationType.INHERIT });
    update(r3(), null);

    expect(auth()).toBeUndefined();
    expect(ctx.commands().at(-1)).toEqual({
      type: 'editRequest',
      id: 'r3',
      changes: { auth: null },
    });
  });
});

describe('creating and changing items', () => {
  let ctx: Setup;

  beforeEach(() => {
    ctx = setup();
  });

  it('addNewRequest creates a never saved draft, opens its folder and selects it', async () => {
    await ctx.store.getState().addNewRequest('New', 'G');

    const [command] = ctx.commands();
    expect(command).toMatchObject({
      type: 'createRequest',
      request: { parentId: 'G', title: 'New', draft: true },
    });
    const { selectedRequestId, requests, openFolders, savedRequests } = ctx.store.getState();
    expect(selectedRequestId).toBe(command.type === 'createRequest' && command.request.id);
    expect(requests.get(selectedRequestId!)!.draft).toBe(true);
    expect(savedRequests.has(selectedRequestId!)).toBe(false);
    expect([...openFolders]).toEqual(expect.arrayContaining(['F', 'G']));
  });

  it('addNewFolder creates an empty folder', async () => {
    await ctx.store.getState().addNewFolder('Folder');

    const [command] = ctx.commands();
    expect(command).toMatchObject({ type: 'createFolder', folder: { parentId: COL_ID } });
    expect(childIds(ctx, COL_ID)).toHaveLength(3);
  });

  it('renames requests and folders', async () => {
    await ctx.store.getState().renameRequest('r1', 'Request');
    await ctx.store.getState().renameFolder('F', 'Folder');

    expect(ctx.commands()).toEqual([
      { type: 'rename', id: 'r1', title: 'Request' },
      { type: 'rename', id: 'F', title: 'Folder' },
    ]);
    expect(ctx.store.getState().folders.get('F')!.title).toBe('Folder');
  });

  it('copyFolder gives the folder and every descendant a new ID', async () => {
    await ctx.store.getState().copyFolder('F');

    const [command] = ctx.commands();
    expect(command.type === 'copy' && Object.keys(command.idMap).sort()).toEqual([
      'F',
      'G',
      'r1',
      'r2',
    ]);
    expect(childIds(ctx, COL_ID)).toHaveLength(3);
  });

  it('copyRequest copies a request to the end of its parent', async () => {
    await ctx.store.getState().copyRequest('r1');

    const copyId = childIds(ctx, 'F')![2];
    expect(ctx.store.getState().requests.get(copyId)!.title).toBe('r1 (Copy)');
  });

  it.each([
    ['copyRequest', 'r1'],
    ['copyFolder', 'F'],
  ] as const)('%s flushes the editor changes before copying', async (action, id) => {
    let commandsWhenFlushed: number | undefined;
    vi.mocked(flushModelEdits).mockImplementationOnce(async () => {
      commandsWhenFlushed = ctx.commands().length;
    });

    await ctx.store.getState()[action](id);

    expect(flushModelEdits).toHaveBeenCalledWith();
    expect(commandsWhenFlushed).toBe(0);
    expect(ctx.commands().map(({ type }) => type)).toEqual(['copy']);
  });

  it('moveItem moves an item into another folder and opens it', async () => {
    await ctx.store.getState().moveItem('r3', 'G', 0);

    expect(ctx.commands()).toEqual([{ type: 'move', id: 'r3', parentId: 'G', index: 0 }]);
    expect(childIds(ctx, 'G')).toEqual(['r3', 'r2']);
    expect(ctx.store.getState().openFolders.has('G')).toBe(true);
  });

  it('changes the collection settings', async () => {
    const { setVariables, setEnvironments, selectEnvironment, renameCollection } =
      ctx.store.getState();

    await setVariables({ host: { value: 'localhost' } });
    await setEnvironments({ dev: { variables: {} }, prod: { variables: {} } });
    await selectEnvironment('prod');
    await renameCollection('Renamed');

    const { collection, selectedEnvironmentKey } = ctx.store.getState();
    expect(collection.variables).toEqual({ host: { value: 'localhost' } });
    expect(Object.keys(collection.environments)).toEqual(['dev', 'prod']);
    expect(selectedEnvironmentKey).toBe('prod');
    expect(collection.title).toBe('Renamed');
  });

  it('sets and clears the client certificate', async () => {
    await ctx.store.getState().setClientCertificate({ certPath: '/cert.pem' });
    expect(ctx.store.getState().collection.clientCertificate).toEqual({ certPath: '/cert.pem' });

    await ctx.store.getState().setClientCertificate(null);
    expect(ctx.commands().at(-1)).toEqual({
      type: 'setClientCertificate',
      clientCertificate: undefined,
    });
    expect(ctx.store.getState().collection.clientCertificate).toBeUndefined();
  });

  it('sets the collection authorization', async () => {
    await ctx.store.getState().setCollectionAuth({ type: AuthorizationType.BEARER, token: 't' });

    expect(ctx.store.getState().collection.auth).toEqual({
      type: AuthorizationType.BEARER,
      token: 't',
    });
  });
});

describe('selected request', () => {
  let ctx: Setup;

  beforeEach(() => {
    ctx = setup();
  });

  it('opens the ancestors of the selected request', () => {
    ctx.store.getState().setSelectedRequest('r2');

    expect([...ctx.store.getState().openFolders].sort()).toEqual(['F', 'G']);
  });

  it('flushes the editor changes of the outgoing request', () => {
    ctx.store.getState().setSelectedRequest('r1');
    ctx.store.getState().setSelectedRequest('r3');

    expect(flushModelEdits).toHaveBeenCalledWith('r1');
  });

  it('deleteRequest cancels the editor changes and deselects the request', async () => {
    ctx.store.getState().setSelectedRequest('r3');

    await ctx.store.getState().deleteRequest('r3');

    // the edits are dropped before deselecting would flush them
    expect(vi.mocked(cancelModelEdits).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(flushModelEdits).mock.invocationCallOrder[0]
    );
    expect(ctx.store.getState().selectedRequestId).toBeUndefined();
    expect(ctx.commands()).toEqual([{ type: 'delete', id: 'r3' }]);
  });

  it('deleteFolder deselects a request inside the folder', async () => {
    ctx.store.getState().setSelectedRequest('r2');

    await ctx.store.getState().deleteFolder('F');

    expect(cancelModelEdits).toHaveBeenCalledWith('r2');
    const { selectedRequestId, openFolders, requests } = ctx.store.getState();
    expect(selectedRequestId).toBeUndefined();
    expect(openFolders.size).toBe(0);
    expect([...requests.keys()]).toEqual(['r3']);
  });

  it('saveRequest flushes the editor changes before saving', async () => {
    ctx.store.getState().setSelectedRequest('r3');
    ctx.store.getState().updateRequest({ method: RequestMethod.PUT });

    await ctx.store.getState().saveRequest('r3');

    expect(flushModelEdits).toHaveBeenCalledWith('r3');
    expect(ctx.commands().at(-1)).toEqual({ type: 'saveRequest', id: 'r3' });
    expect(ctx.store.getState().requests.get('r3')!.draft).toBe(false);
  });

  it('discardChanges restores the saved state and reloads the editor content', async () => {
    vi.mocked(IpcPushStream.open).mockResolvedValue({
      readAll: () => Promise.resolve('saved'),
    } as unknown as IpcPushStream);
    ctx.store.getState().setSelectedRequest('r3');
    ctx.store.getState().updateRequest({ method: RequestMethod.PUT });

    await ctx.store.getState().discardChanges();

    expect(cancelModelEdits).toHaveBeenCalledWith('r3');
    expect(ctx.store.getState().requests.get('r3')).toMatchObject({
      method: RequestMethod.GET,
      draft: false,
    });
    expect(IpcPushStream.open).toHaveBeenCalledWith(
      { type: 'request-body', requestId: 'r3' },
      'utf-8'
    );
    expect(IpcPushStream.open).toHaveBeenCalledWith(
      { type: 'script', source: ScriptType.PRE_REQUEST, requestId: 'r3' },
      'utf-8'
    );
  });

  it('discardChanges deletes a request that was never saved', async () => {
    await ctx.store.getState().addNewRequest('New');
    const id = ctx.store.getState().selectedRequestId!;

    await ctx.store.getState().discardChanges();

    expect(ctx.store.getState().requests.has(id)).toBe(false);
    expect(ctx.store.getState().selectedRequestId).toBeUndefined();
  });
});

describe('model updates', () => {
  it('prunes UI state to IDs that still exist', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r2');
    ctx.store.getState().setSelection(['r1', 'r3']);
    const commandId = 'foreign';

    await ctx.main.dispatch({ commandId, timestamp: 1, command: { type: 'delete', id: 'G' } });

    const { selectedRequestId, openFolders, selectedIds } = ctx.store.getState();
    expect(selectedRequestId).toBeUndefined();
    expect([...openFolders]).toEqual(['F']);
    expect([...selectedIds]).toEqual(['r1', 'r3']);
  });

  it('resets UI state when another collection is opened', () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r2');
    ctx.store.getState().setSelection(['r1']);

    ctx.main.emit({
      kind: 'snapshot',
      model: normalizeCollection(makeCollection('other', [makeRequest('r2', 'other')])),
    });

    const { collection, selectedRequestId, openFolders, selectedIds } = ctx.store.getState();
    expect(collection.id).toBe('other');
    expect(selectedRequestId).toBeUndefined();
    expect(openFolders.size).toBe(0);
    expect(selectedIds.size).toBe(0);
  });

  it('resets UI state when a collection with the same ID is opened from another directory', () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r2');
    ctx.store.getState().setSelection(['r1']);

    ctx.main.emit({
      kind: 'snapshot',
      model: normalizeCollection({ ...defaultCollection(), dirPath: '/copy-of-col' }),
    });

    const { collection, selectedRequestId, openFolders, selectedIds } = ctx.store.getState();
    expect(collection.dirPath).toBe('/copy-of-col');
    expect(selectedRequestId).toBeUndefined();
    expect(openFolders.size).toBe(0);
    expect(selectedIds.size).toBe(0);
  });
});

describe('collections', () => {
  it('changeCollection flushes editor changes and opens the collection', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r1');

    await ctx.store.getState().changeCollection('/other');

    expect(flushModelEdits).toHaveBeenCalledWith();
    expect(eventService.openCollection).toHaveBeenCalledWith('/other');
    expect(ctx.store.getState().selectedRequestId).toBeUndefined();
  });

  it('closeCollection closes the current collection by default', async () => {
    const ctx = setup();

    await ctx.store.getState().closeCollection();

    expect(flushModelEdits).toHaveBeenCalledWith();
    expect(eventService.closeCollection).toHaveBeenCalledWith(`/${COL_ID}`);
  });
});

describe('bulk actions', () => {
  it('deletes only the top-level selected items and clears the selection', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r2');
    ctx.store.getState().setSelection(['F', 'r1', 'r3']);

    await ctx.store.getState().deleteSelectedItems();

    expect(ctx.commands()).toEqual([
      { type: 'delete', id: 'F' },
      { type: 'delete', id: 'r3' },
    ]);
    expect(cancelModelEdits).toHaveBeenCalledWith('r2');
    const { selectedIds, selectedRequestId, isBulkActionRunning } = ctx.store.getState();
    expect(selectedIds.size).toBe(0);
    expect(selectedRequestId).toBeUndefined();
    expect(isBulkActionRunning).toBe(false);
  });

  it('duplicates only the top-level selected items and keeps the open request', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r1');
    ctx.store.getState().setSelection(['F', 'r1', 'r3']);

    await ctx.store.getState().duplicateSelectedItems();

    expect(ctx.commands().map(({ type }) => type)).toEqual(['copy', 'copy']);
    expect(ctx.store.getState().selectedRequestId).toBe('r1');
    expect(childIds(ctx, COL_ID)).toHaveLength(4);
  });

  it('flushes the editor changes once before duplicating', async () => {
    const ctx = setup();
    ctx.store.getState().setSelection(['F', 'r3']);
    const commandsWhenFlushed: number[] = [];
    vi.mocked(flushModelEdits).mockImplementationOnce(async () => {
      commandsWhenFlushed.push(ctx.commands().length);
    });

    await ctx.store.getState().duplicateSelectedItems();

    expect(commandsWhenFlushed).toEqual([0]);
    expect(ctx.commands().map(({ type }) => type)).toEqual(['copy', 'copy']);
  });

  it('cancels the editor changes of each item right before deleting it', async () => {
    const ctx = setup();
    ctx.store.getState().setSelection(['F', 'r3']);
    const commandsWhenCancelled = new Map<string, number>();
    const original = vi.mocked(cancelModelEdits).getMockImplementation();
    vi.mocked(cancelModelEdits).mockImplementation((id) => {
      commandsWhenCancelled.set(id, ctx.commands().length);
    });

    try {
      await ctx.store.getState().deleteSelectedItems();
    } finally {
      vi.mocked(cancelModelEdits).mockImplementation(original!);
    }

    expect(commandsWhenCancelled.get('r1')).toBe(0);
    expect(commandsWhenCancelled.get('r3')).toBe(1);
  });

  it('ignores a second call while the first is still in flight', async () => {
    const ctx = setup();
    ctx.store.getState().setSelection(['r3']);

    const first = ctx.store.getState().deleteSelectedItems();
    await ctx.store.getState().deleteSelectedItems();
    await first;

    expect(ctx.commands()).toEqual([{ type: 'delete', id: 'r3' }]);
  });

  it('resets the in-flight flag after a rejection', async () => {
    const ctx = setup();
    ctx.store.getState().setSelection(['r3']);
    ctx.main.rejectNext = new Error('failed');

    await expect(ctx.store.getState().deleteSelectedItems()).rejects.toThrow('failed');

    expect(ctx.store.getState().isBulkActionRunning).toBe(false);
    expect(ctx.store.getState().selectedIds.size).toBe(0);
  });
});

describe('moveItemsAfter', () => {
  it('keeps a same-parent group contiguous after the anchor even when indices would drift (I17)', async () => {
    const ids = ['P', 'B', 'Q', 'C', 'R', 'A', 'S'];
    const ctx = setup(
      makeCollection(
        COL_ID,
        ids.map((id) => makeRequest(id, COL_ID))
      )
    );

    // The actively-dragged item is dropped first, as handleDragEnd does.
    await ctx.store.getState().moveItem('A', COL_ID, 2);
    expect(childIds(ctx, COL_ID)).toEqual(['P', 'B', 'A', 'Q', 'C', 'R', 'S']);

    await ctx.store.getState().moveItemsAfter('A', ['B', 'C']);

    expect(childIds(ctx, COL_ID)).toEqual(['P', 'A', 'B', 'C', 'Q', 'R', 'S']);
  });

  it('gathers items from different parents into one contiguous run after the anchor', async () => {
    const ctx = setup(
      makeCollection(COL_ID, [
        makeFolder('F1', COL_ID, [makeRequest('X', 'F1'), makeRequest('B', 'F1')]),
        makeFolder('F2', COL_ID, [makeRequest('C', 'F2'), makeRequest('Y', 'F2')]),
        makeFolder('T', COL_ID, [
          makeRequest('P', 'T'),
          makeRequest('A', 'T'),
          makeRequest('Q', 'T'),
          makeRequest('D', 'T'),
        ]),
      ])
    );

    await ctx.store.getState().moveItemsAfter('A', ['B', 'C', 'D']);

    expect(childIds(ctx, 'T')).toEqual(['P', 'A', 'B', 'C', 'D', 'Q']);
    expect(childIds(ctx, 'F1')).toEqual(['X']);
    expect(childIds(ctx, 'F2')).toEqual(['Y']);
    const { requests } = ctx.store.getState();
    expect(['B', 'C', 'D'].map((id) => requests.get(id)!.parentId)).toEqual(['T', 'T', 'T']);
  });

  it('follows the anchor into its current parent when the anchor itself was moved', async () => {
    const ctx = setup(
      makeCollection(COL_ID, [
        makeRequest('A', COL_ID),
        makeRequest('B', COL_ID),
        makeFolder('T', COL_ID, [makeRequest('P', 'T')]),
      ])
    );

    await ctx.store.getState().moveItem('A', 'T', 0);
    await ctx.store.getState().moveItemsAfter('A', ['B']);

    expect(childIds(ctx, 'T')).toEqual(['A', 'B', 'P']);
    expect(childIds(ctx, COL_ID)).toEqual(['T']);
  });

  it.each([
    ['is a group member', 'F'],
    ['is a descendant of a group member', 'F-sub'],
  ])('throws without moving anything when the anchor parent %s (I20)', async (_, parentId) => {
    const anchor = makeRequest('A', parentId);
    const ctx = setup(
      makeCollection(COL_ID, [
        makeRequest('P', COL_ID),
        makeFolder('F', COL_ID, [
          makeFolder('F-sub', 'F', parentId === 'F-sub' ? [anchor] : []),
          ...(parentId === 'F' ? [anchor] : []),
        ]),
        makeRequest('B', COL_ID),
      ])
    );

    await expect(ctx.store.getState().moveItemsAfter('A', ['B', 'F'])).rejects.toThrow(
      /one of the moved items or inside one/
    );

    expect(ctx.commands()).toEqual([]);
  });

  it('throws when the anchor does not exist', async () => {
    const ctx = setup();

    await expect(ctx.store.getState().moveItemsAfter('missing', ['r1'])).rejects.toThrow(
      /item not found/
    );
    expect(ctx.commands()).toEqual([]);
  });
});

describe('createModelPersistence', () => {
  it('sends text bodies and scripts as commands', async () => {
    const ctx = setup();
    const persistence = createModelPersistence(ctx.replica);

    await persistence.setTextBody('r1', 'body');
    await persistence.setScript('r1', ScriptType.POST_RESPONSE, 'script');

    expect(ctx.commands()).toEqual([
      { type: 'setTextBody', id: 'r1', text: 'body' },
      { type: 'setScript', id: 'r1', scriptType: ScriptType.POST_RESPONSE, text: 'script' },
    ]);
    expect(ctx.store.getState().requests.get('r1')!.draft).toBe(true);
  });

  it('marks a request as draft only once', async () => {
    const ctx = setup();
    const persistence = createModelPersistence(ctx.replica);

    await persistence.markDraft('r1');
    await persistence.markDraft('r1');

    expect(ctx.commands()).toEqual([{ type: 'editRequest', id: 'r1', changes: {} }]);
  });

  it('rejects instead of throwing for a request that does not exist', async () => {
    const ctx = setup();

    await expect(createModelPersistence(ctx.replica).setTextBody('missing', '')).rejects.toThrow();
  });
});

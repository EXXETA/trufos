import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCollectionStore } from './collectionStore';
import { FakeCollectionMain } from '@/__mocks__/fake-collection-main';
import { makeCollection, makeFolder, makeRequest } from 'shim/__mocks__/collection-fixtures';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { HttpService } from '@/services/http/http-service';
import { showError } from '@/error/errorHandler';
import { loadEditorContent } from '@/lib/monaco/editor-content';
import { IpcPushStream } from '@/lib/ipc-stream';
import {
  cancelModelEdits,
  disposeModelsForRequest,
  flushModelEdits,
  getBodyModel,
  getScriptModel,
  MODEL_EDIT_DEBOUNCE_MS,
} from '@/lib/monaco/models';
import { CollectionCommand, CommandType, normalizeCollection } from 'shim/collection-model';
import { Collection } from 'shim/objects/collection';
import { AuthorizationType } from 'shim/objects/auth';
import { RequestBodyType } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { ScriptType } from 'shim/scripting';
import { SortMode } from 'shim/sort-mode';
import { CollectionUiState } from 'shim/collection-ui-state';
import { UI_STATE_SAVE_DELAY_MS } from '@/state/helper/collection-ui-state';

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      openCollection: vi.fn().mockResolvedValue(undefined),
      closeCollection: vi.fn().mockResolvedValue(undefined),
      saveCollectionUiState: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('@/services/http/http-service', () => ({
  HttpService: { instance: { sendRequest: vi.fn() } },
}));

vi.mock('@/error/errorHandler', () => ({
  showError: vi.fn(),
}));

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: { open: vi.fn() },
}));

vi.mock('@/lib/monaco/editor-content', () => ({
  loadEditorContent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/monaco/models', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/monaco/models')>();
  return {
    ...actual,
    cancelModelEdits: vi.fn(actual.cancelModelEdits),
    disposeModelsForRequest: vi.fn(actual.disposeModelsForRequest),
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

const setup = (
  collection: Collection = defaultCollection(),
  savedRequests = [],
  ui?: CollectionUiState
) => {
  const main = new FakeCollectionMain(normalizeCollection(collection, savedRequests));
  const { store, collectionState, flushUiState } = createCollectionStore(
    { model: structuredClone(main.model), ui },
    // looked up per call, so tests can replace it
    (envelope) => main.dispatch(envelope),
    main.getCollectionState
  );
  main.onEvent((event) => collectionState.receive(event));
  const commands = (): CollectionCommand[] => main.received.map(({ command }) => command);
  return { main, store, commands, flushUiState };
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
      { type: CommandType.EDIT_REQUEST, id: 'r3', changes: { method: RequestMethod.POST } },
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

  it('editHeaders sends the complete new header list, but nothing if it stays the same', () => {
    const { editHeaders } = ctx.store.getState();

    editHeaders((headers) => headers.map((header) => ({ ...header })));
    expect(ctx.commands()).toEqual([]);

    editHeaders((headers) => [...headers, { key: 'X-Test', value: '1', isActive: true }]);
    expect(request().headers).toEqual([{ key: 'X-Test', value: '1', isActive: true }]);
    expect(ctx.commands()).toEqual([
      {
        type: CommandType.EDIT_REQUEST,
        id: 'r3',
        changes: { headers: [{ key: 'X-Test', value: '1', isActive: true }] },
      },
    ]);
  });

  it('setInheritedHeaderEnabled disables and enables inherited headers by their normalized key', () => {
    const { setInheritedHeaderEnabled } = ctx.store.getState();

    setInheritedHeaderEnabled('X-Tenant', true);
    expect(ctx.commands()).toEqual([]);

    setInheritedHeaderEnabled('X-Tenant', false);
    setInheritedHeaderEnabled('X-Trace', false);
    expect(request().disabledInheritedHeaders).toEqual(['x-tenant', 'x-trace']);

    setInheritedHeaderEnabled('x-tenant', true);
    setInheritedHeaderEnabled('x-trace', true);
    expect(request().disabledInheritedHeaders).toBeUndefined();
    expect(ctx.commands().at(-1)).toMatchObject({ changes: { disabledInheritedHeaders: null } });
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
      type: CommandType.EDIT_REQUEST,
      id: 'r3',
      changes: { url: { base: 'http://localhost', query: [] } },
    });
  });

  it('sends nothing if a recipe changes nothing', () => {
    const { setRequestBodyMimeType } = ctx.store.getState();

    setRequestBodyMimeType(undefined);
    expect(ctx.commands()).toEqual([]);

    setRequestBodyMimeType('application/json');
    expect(ctx.commands()).toEqual([
      { type: CommandType.EDIT_REQUEST, id: 'r3', changes: { body: expect.anything() } },
    ]);
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

describe('creating and changing items', () => {
  let ctx: Setup;

  beforeEach(() => {
    ctx = setup();
  });

  it('addNewRequest creates a never saved draft, opens its folder and selects it', async () => {
    await ctx.store.getState().addNewRequest('New', 'G');

    const [command] = ctx.commands();
    expect(command).toMatchObject({
      type: CommandType.CREATE_REQUEST,
      request: { parentId: 'G', title: 'New', draft: true },
    });
    const { selectedRequestId, requests, openFolders, savedRequests } = ctx.store.getState();
    expect(selectedRequestId).toBe(
      command.type === CommandType.CREATE_REQUEST && command.request.id
    );
    expect(requests.get(selectedRequestId!)!.draft).toBe(true);
    expect(savedRequests.has(selectedRequestId!)).toBe(false);
    expect([...openFolders]).toEqual(expect.arrayContaining(['F', 'G']));
  });

  it('addNewFolder creates an empty folder', async () => {
    await ctx.store.getState().addNewFolder('Folder');

    const [command] = ctx.commands();
    expect(command).toMatchObject({
      type: CommandType.CREATE_FOLDER,
      folder: { parentId: COL_ID },
    });
    expect(childIds(ctx, COL_ID)).toHaveLength(3);
  });

  it('renameItem renames requests and folders', async () => {
    await ctx.store.getState().renameItem('r1', 'Request');
    await ctx.store.getState().renameItem('F', 'Folder');

    expect(ctx.commands()).toEqual([
      { type: CommandType.RENAME, id: 'r1', title: 'Request' },
      { type: CommandType.RENAME, id: 'F', title: 'Folder' },
    ]);
    expect(ctx.store.getState().folders.get('F')!.title).toBe('Folder');
  });

  it('copyItem gives a folder and every descendant a new ID', async () => {
    await ctx.store.getState().copyItem('F');

    const [command] = ctx.commands();
    expect(command.type === CommandType.COPY && Object.keys(command.idMap).sort()).toEqual([
      'F',
      'G',
      'r1',
      'r2',
    ]);
    expect(childIds(ctx, COL_ID)).toHaveLength(3);
  });

  it('copyItem copies a request to the end of its parent', async () => {
    await ctx.store.getState().copyItem('r1');

    const copyId = childIds(ctx, 'F')![2];
    expect(ctx.store.getState().requests.get(copyId)!.title).toBe('r1 (Copy)');
  });

  it.each(['r1', 'F'])('copyItem flushes the editor changes before copying %s', async (id) => {
    let commandsWhenFlushed: number | undefined;
    vi.mocked(flushModelEdits).mockImplementationOnce(async () => {
      commandsWhenFlushed = ctx.commands().length;
    });

    await ctx.store.getState().copyItem(id);

    expect(flushModelEdits).toHaveBeenCalledWith();
    expect(commandsWhenFlushed).toBe(0);
    expect(ctx.commands().map(({ type }) => type)).toEqual([CommandType.COPY]);
  });

  it('moveItems moves an item into another folder and opens it', async () => {
    await ctx.store.getState().moveItems(['r3'], 'G', 0);

    expect(ctx.commands()).toEqual([
      { type: CommandType.MOVE, ids: ['r3'], parentId: 'G', index: 0 },
    ]);
    expect(childIds(ctx, 'G')).toEqual(['r3', 'r2']);
    expect(ctx.store.getState().openFolders.has('G')).toBe(true);
  });

  it('selects an environment, or none, without changing the collection', async () => {
    const ctx = setup({
      ...defaultCollection(),
      environments: { dev: { variables: {} }, prod: { variables: {} } },
    });
    const { selectEnvironment } = ctx.store.getState();

    await selectEnvironment('prod');
    expect(ctx.store.getState().selectedEnvironmentKey).toBe('prod');
    await selectEnvironment(undefined);

    expect(ctx.store.getState().selectedEnvironmentKey).toBeUndefined();
    expect(ctx.commands()).toEqual([
      { type: CommandType.UPDATE_COLLECTION, changes: {}, selectedEnvironmentKey: 'prod' },
      { type: CommandType.UPDATE_COLLECTION, changes: {}, selectedEnvironmentKey: null },
    ]);
  });

  it('changes the collection settings', async () => {
    const { updateCollection } = ctx.store.getState();

    await updateCollection(
      {
        title: 'Renamed',
        variables: { host: { value: 'localhost' } },
        environments: { dev: { variables: {} }, prod: { variables: {} } },
      },
      'prod'
    );

    expect(ctx.commands()).toEqual([
      {
        type: CommandType.UPDATE_COLLECTION,
        changes: {
          title: 'Renamed',
          variables: { host: { value: 'localhost' } },
          environments: { dev: { variables: {} }, prod: { variables: {} } },
        },
        selectedEnvironmentKey: 'prod',
      },
    ]);
    const { collection, selectedEnvironmentKey } = ctx.store.getState();
    expect(collection.variables).toEqual({ host: { value: 'localhost' } });
    expect(Object.keys(collection.environments)).toEqual(['dev', 'prod']);
    expect(selectedEnvironmentKey).toBe('prod');
    expect(collection.title).toBe('Renamed');
  });

  it('sets and removes the client certificate and the collection authorization', async () => {
    const { updateCollection } = ctx.store.getState();

    await updateCollection({
      clientCertificate: { certPath: '/cert.pem' },
      auth: { type: AuthorizationType.BEARER, token: 't' },
    });
    expect(ctx.store.getState().collection).toMatchObject({
      clientCertificate: { certPath: '/cert.pem' },
      auth: { type: AuthorizationType.BEARER, token: 't' },
    });

    await updateCollection({ clientCertificate: null, auth: null });
    expect(ctx.store.getState().collection.clientCertificate).toBeUndefined();
    expect(ctx.store.getState().collection.auth).toBeUndefined();
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

  it('flushes the editor changes of the outgoing request', async () => {
    ctx.store.getState().setSelectedRequest('r1');
    let flushed = false;
    vi.mocked(flushModelEdits).mockImplementationOnce(async () => {
      flushed = true;
    });

    await ctx.store.getState().setSelectedRequest('r3');

    expect(flushModelEdits).toHaveBeenCalledWith('r1');
    expect(flushed).toBe(true);
  });

  it('resolves at once if no request was selected before', async () => {
    await ctx.store.getState().setSelectedRequest('r3');

    expect(flushModelEdits).not.toHaveBeenCalled();
    expect(ctx.store.getState().selectedRequestId).toBe('r3');
  });

  it('deleteItem drops the editor changes and deselects the request', async () => {
    ctx.store.getState().setSelectedRequest('r3');

    await ctx.store.getState().deleteItem('r3');

    expect(disposeModelsForRequest).toHaveBeenCalledWith('r3');
    expect(flushModelEdits).toHaveBeenCalledWith('r3');
    expect(ctx.store.getState().selectedRequestId).toBeUndefined();
    expect(ctx.commands()).toEqual([{ type: CommandType.DELETE, ids: ['r3'] }]);
  });

  it('deleteItem deselects a request inside a deleted folder', async () => {
    ctx.store.getState().setSelectedRequest('r2');

    await ctx.store.getState().deleteItem('F');

    expect(disposeModelsForRequest).toHaveBeenCalledWith('r2');
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
    expect(ctx.commands().at(-1)).toEqual({ type: CommandType.SAVE_REQUEST, id: 'r3' });
    expect(ctx.store.getState().requests.get('r3')!.draft).toBe(false);
  });

  it('sendRequest flushes the editor changes before sending', async () => {
    const sendRequest = vi.mocked(HttpService.instance.sendRequest).mockResolvedValue(null);

    await expect(ctx.store.getState().sendRequest('r3')).resolves.toBeNull();

    expect(vi.mocked(flushModelEdits).mock.invocationCallOrder[0]).toBeLessThan(
      sendRequest.mock.invocationCallOrder[0]
    );
    expect(sendRequest).toHaveBeenCalledWith('r3', undefined);
  });

  it('loads the editor content of the selected request', () => {
    ctx.store.getState().setSelectedRequest('r3');

    expect(loadEditorContent).toHaveBeenCalledExactlyOnceWith('r3');
  });

  it('discardChanges restores the saved state and reloads the editor content', async () => {
    ctx.store.getState().setSelectedRequest('r3');
    ctx.store.getState().updateRequest({ method: RequestMethod.PUT });
    vi.mocked(loadEditorContent).mockClear();

    await ctx.store.getState().discardChanges();

    expect(cancelModelEdits).toHaveBeenCalledWith('r3');
    const restored = ctx.store.getState().requests.get('r3');
    expect(restored).toMatchObject({ method: RequestMethod.GET, draft: false });
    expect(loadEditorContent).toHaveBeenCalledExactlyOnceWith('r3', {
      after: expect.any(Promise),
    });
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

    await ctx.main.dispatch({
      commandId,
      timestamp: 1,
      command: { type: CommandType.DELETE, ids: ['G'] },
    });

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

    expect(vi.mocked(flushModelEdits).mock.invocationCallOrder[0]).toBeLessThan(
      eventService.openCollection.mock.invocationCallOrder[0]
    );
    expect(eventService.openCollection).toHaveBeenCalledWith('/other');
    // the selection changes once main broadcast the other collection
    expect(ctx.store.getState().selectedRequestId).toBe('r1');
  });

  it('drops the editor changes of the request when another collection is opened', () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r1');

    ctx.main.emit({
      kind: 'snapshot',
      model: normalizeCollection(makeCollection('other', [makeRequest('o1', 'other')])),
    });

    expect(disposeModelsForRequest).toHaveBeenCalledWith('r1');
    expect(ctx.store.getState().selectedRequestId).toBeUndefined();
  });

  it('changeCollection keeps the collection open if the editor changes could not be sent', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r1');
    vi.mocked(flushModelEdits).mockRejectedValueOnce(new Error('failed'));

    await expect(ctx.store.getState().changeCollection('/other')).resolves.toBe(false);

    expect(eventService.openCollection).not.toHaveBeenCalled();
  });

  it('closeCollection closes the current collection by default', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r1');

    await ctx.store.getState().closeCollection();

    expect(flushModelEdits).toHaveBeenCalled();
    expect(eventService.closeCollection).toHaveBeenCalledWith(`/${COL_ID}`);
  });
});

describe('UI state', () => {
  const uiState = (state: Partial<CollectionUiState>) => CollectionUiState.parse(state);
  const otherCollection = () =>
    normalizeCollection(makeCollection('other', [makeRequest('o1', 'other')]));

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores the UI state of the snapshot', () => {
    const { store } = setup(
      defaultCollection(),
      [],
      uiState({
        selectedRequestId: 'r2',
        openFolders: ['F'],
        sortMode: SortMode.AZ_DESC,
        currentScriptType: ScriptType.POST_RESPONSE,
      })
    );

    const { selectedRequestId, openFolders, sortMode, currentScriptType } = store.getState();
    expect(selectedRequestId).toBe('r2');
    expect([...openFolders].sort()).toEqual(['F', 'G']);
    expect(sortMode).toBe(SortMode.AZ_DESC);
    expect(currentScriptType).toBe(ScriptType.POST_RESPONSE);
    expect(loadEditorContent).toHaveBeenCalledExactlyOnceWith('r2');
  });

  it('does not restore IDs that no longer exist', () => {
    const { store } = setup(
      defaultCollection(),
      [],
      uiState({ selectedRequestId: 'gone', openFolders: ['F', 'gone'] })
    );

    const { selectedRequestId, openFolders } = store.getState();
    expect(selectedRequestId).toBeUndefined();
    expect([...openFolders]).toEqual(['F']);
  });

  it('restores the UI state of another collection that is opened', () => {
    const ctx = setup();
    ctx.store.getState().setSortMode(SortMode.TIME_ASC);

    ctx.main.emit({
      kind: 'snapshot',
      model: otherCollection(),
      ui: uiState({ selectedRequestId: 'o1' }),
    });

    expect(ctx.store.getState().selectedRequestId).toBe('o1');
    expect(ctx.store.getState().sortMode).toBe(SortMode.DEFAULT);
  });

  it('sends nothing for the restored UI state', () => {
    vi.useFakeTimers();
    setup(defaultCollection(), [], uiState({ selectedRequestId: 'r2' }));

    vi.advanceTimersByTime(UI_STATE_SAVE_DELAY_MS);

    expect(eventService.saveCollectionUiState).not.toHaveBeenCalled();
  });

  it('sends the latest UI state to main once it stopped changing', () => {
    vi.useFakeTimers();
    const ctx = setup();

    ctx.store.getState().setSortMode(SortMode.AZ_ASC);
    ctx.store.getState().setFolderOpen('F');
    vi.advanceTimersByTime(UI_STATE_SAVE_DELAY_MS - 1);
    expect(eventService.saveCollectionUiState).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(eventService.saveCollectionUiState).toHaveBeenCalledExactlyOnceWith(`/${COL_ID}`, {
      openFolders: ['F'],
      sortMode: SortMode.AZ_ASC,
      currentScriptType: ScriptType.PRE_REQUEST,
    });
  });

  it('flushUiState sends the pending UI state right away', async () => {
    const ctx = setup();
    ctx.store.getState().setCurrentScriptType(ScriptType.POST_RESPONSE);

    await ctx.flushUiState();

    expect(eventService.saveCollectionUiState).toHaveBeenCalledExactlyOnceWith(
      `/${COL_ID}`,
      expect.objectContaining({ currentScriptType: ScriptType.POST_RESPONSE })
    );
  });

  it('sends the pending UI state of a collection before another one is opened', () => {
    const ctx = setup();
    ctx.store.getState().setSortMode(SortMode.TIME_ASC);

    ctx.main.emit({ kind: 'snapshot', model: otherCollection() });

    expect(eventService.saveCollectionUiState).toHaveBeenCalledExactlyOnceWith(
      `/${COL_ID}`,
      expect.objectContaining({ sortMode: SortMode.TIME_ASC })
    );
  });

  it('sends that no request is selected once the selected one is deleted', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r3');

    await ctx.store.getState().deleteItem('r3');
    await ctx.flushUiState();

    expect(eventService.saveCollectionUiState).toHaveBeenLastCalledWith(
      `/${COL_ID}`,
      expect.not.objectContaining({ selectedRequestId: 'r3' })
    );
  });

  it('only logs if the UI state cannot be sent', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    eventService.saveCollectionUiState.mockRejectedValueOnce(new Error('failed'));
    const ctx = setup();
    ctx.store.getState().setSortMode(SortMode.AZ_ASC);

    await expect(ctx.flushUiState()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('selection', () => {
  it('addToSelection keeps the items that are already selected', () => {
    const ctx = setup();
    ctx.store.getState().setSelection(['r1']);

    ctx.store.getState().addToSelection(['r1', 'F']);

    expect([...ctx.store.getState().selectedIds]).toEqual(['r1', 'F']);
  });
});

describe('bulk actions', () => {
  it('deletes only the top-level selected items with one command and clears the selection', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r2');
    ctx.store.getState().setSelection(['F', 'r1', 'r3']);

    await ctx.store.getState().deleteSelectedItems();

    expect(ctx.commands()).toEqual([{ type: CommandType.DELETE, ids: ['F', 'r3'] }]);
    expect(disposeModelsForRequest).toHaveBeenCalledWith('r2');
    const { selectedIds, selectedRequestId } = ctx.store.getState();
    expect(selectedIds.size).toBe(0);
    expect(selectedRequestId).toBeUndefined();
  });

  it('duplicates only the top-level selected items and keeps the open request', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r1');
    ctx.store.getState().setSelection(['F', 'r1', 'r3']);

    await ctx.store.getState().duplicateSelectedItems();

    const [command] = ctx.commands();
    expect(ctx.commands()).toHaveLength(1);
    expect(command).toMatchObject({ type: CommandType.COPY, ids: ['F', 'r3'] });
    expect(ctx.store.getState().selectedRequestId).toBe('r1');
    expect(childIds(ctx, COL_ID)).toHaveLength(4);
  });

  it('flushes the editor changes before duplicating', async () => {
    const ctx = setup();
    ctx.store.getState().setSelection(['F', 'r3']);
    const commandsWhenFlushed: number[] = [];
    vi.mocked(flushModelEdits).mockImplementationOnce(async () => {
      commandsWhenFlushed.push(ctx.commands().length);
    });

    await ctx.store.getState().duplicateSelectedItems();

    expect(commandsWhenFlushed).toEqual([0]);
    expect(ctx.commands().map(({ type }) => type)).toEqual([CommandType.COPY]);
  });

  it('ignores a second call while the first is still in flight', async () => {
    const ctx = setup();
    ctx.store.getState().setSelection(['r3']);

    const first = ctx.store.getState().deleteSelectedItems();
    await ctx.store.getState().deleteSelectedItems();
    await first;

    expect(ctx.commands()).toEqual([{ type: CommandType.DELETE, ids: ['r3'] }]);
  });

  it('shows the error and clears the selection if the command is rejected', async () => {
    const ctx = setup();
    ctx.store.getState().setSelection(['r3']);
    ctx.main.rejectNext = new Error('failed');

    await expect(ctx.store.getState().deleteSelectedItems()).resolves.toBe(false);

    expect(showError).toHaveBeenCalledWith('Could not delete the items', expect.any(Error));
    expect(ctx.store.getState().selectedIds.size).toBe(0);
  });
});

describe('moveItems', () => {
  it('moves items from different parents into one contiguous run', async () => {
    const ctx = setup(
      makeCollection(COL_ID, [
        makeFolder('F1', COL_ID, [makeRequest('X', 'F1'), makeRequest('B', 'F1')]),
        makeFolder('F2', COL_ID, [makeRequest('C', 'F2'), makeRequest('Y', 'F2')]),
        makeFolder('T', COL_ID, [makeRequest('P', 'T'), makeRequest('Q', 'T')]),
      ])
    );

    await ctx.store.getState().moveItems(['B', 'C'], 'T', 1);

    expect(ctx.commands()).toEqual([
      { type: CommandType.MOVE, ids: ['B', 'C'], parentId: 'T', index: 1 },
    ]);
    expect(childIds(ctx, 'T')).toEqual(['P', 'B', 'C', 'Q']);
    expect(childIds(ctx, 'F1')).toEqual(['X']);
    expect(childIds(ctx, 'F2')).toEqual(['Y']);
  });

  it('rejects moving a folder into itself without sending anything', async () => {
    const ctx = setup();

    await expect(ctx.store.getState().moveItems(['F'], 'G', 0)).resolves.toBe(false);

    expect(ctx.commands()).toEqual([]);
    expect(showError).toHaveBeenCalledWith('Could not move the items', expect.any(Error));
  });
});

describe('editor models', () => {
  // the models are global, earlier tests may have created them for another store
  beforeEach(() => disposeModelsForRequest('r1'));

  /** Simulates typing, which, unlike `setValue`, is not a flush. */
  const type = (model: ReturnType<typeof getBodyModel>, text: string) =>
    model.applyEdits([{ range: model.getFullModelRange(), text }]);

  it('sends text bodies and scripts of the selected request as commands', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r1');

    type(getBodyModel('r1'), 'body');
    type(getScriptModel('r1', ScriptType.POST_RESPONSE), 'script');
    await flushModelEdits('r1');

    expect(ctx.commands()).toEqual([
      { type: CommandType.CREATE_DRAFT, id: 'r1' },
      { type: CommandType.SET_TEXT_BODY, id: 'r1', text: 'body' },
      {
        type: CommandType.SET_SCRIPT,
        id: 'r1',
        scriptType: ScriptType.POST_RESPONSE,
        text: 'script',
      },
    ]);
    expect(ctx.store.getState().requests.get('r1')!.draft).toBe(true);
  });

  /** Lets main reject every command of the given type. */
  const rejectCommands = ({ main }: Setup, type: CommandType) => {
    const dispatch = main.dispatch;
    main.dispatch = async (envelope) => {
      if (envelope.command.type !== type) return await dispatch(envelope);
      main.received.push(envelope);
      throw new Error('rejected');
    };
  };

  it('sends the editor changes before a delete, so a rejected delete loses nothing', async () => {
    const ctx = setup();
    rejectCommands(ctx, CommandType.DELETE);
    ctx.store.getState().setSelectedRequest('r1');
    type(getBodyModel('r1'), 'body');

    await expect(ctx.store.getState().deleteItem('r1')).resolves.toBe(false);

    expect(ctx.commands()).toEqual([
      { type: CommandType.CREATE_DRAFT, id: 'r1' },
      { type: CommandType.SET_TEXT_BODY, id: 'r1', text: 'body' },
      { type: CommandType.DELETE, ids: ['r1'] },
    ]);
    expect(ctx.store.getState().requests.get('r1')!.draft).toBe(true);
  });

  it('sends the editor changes of a request inside a deleted folder first', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r1');
    type(getBodyModel('r1'), 'body');

    await ctx.store.getState().deleteItem('F');

    expect(ctx.commands().slice(1)).toEqual([
      { type: CommandType.SET_TEXT_BODY, id: 'r1', text: 'body' },
      { type: CommandType.DELETE, ids: ['F'] },
    ]);
    expect(ctx.store.getState().requests.has('r1')).toBe(false);
  });

  beforeEach(() => {
    vi.mocked(loadEditorContent).mockResolvedValue(undefined);
  });

  /** Loads the editor content for real from now on, with the given content for every model. */
  const loadEditorContentFor = async (content: string) => {
    const actual = await vi.importActual<typeof import('@/lib/monaco/editor-content')>(
      '@/lib/monaco/editor-content'
    );
    vi.mocked(loadEditorContent).mockImplementation(actual.loadEditorContent);
    vi.mocked(IpcPushStream.open).mockResolvedValue({
      readAll: async () => content,
    } as Awaited<ReturnType<typeof IpcPushStream.open>>);
  };

  it('discards a request that was never saved without an error', async () => {
    const ctx = setup();
    await loadEditorContentFor('');
    await ctx.store.getState().addNewRequest('New');
    const id = ctx.store.getState().selectedRequestId!;

    await expect(ctx.store.getState().discardChanges()).resolves.toBe(true);

    expect(ctx.store.getState().requests.has(id)).toBe(false);
    expect(showError).not.toHaveBeenCalled();
  });

  it('reloads the draft into the editor if discarding is rejected', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r1');
    type(getBodyModel('r1'), 'changed');
    await loadEditorContentFor('persisted draft');
    ctx.main.rejectNext = new Error('rejected');

    const discarded = ctx.store.getState().discardChanges();
    type(getBodyModel('r1'), 'typed meanwhile');

    await expect(discarded).resolves.toBe(false);
    await vi.waitFor(() => expect(getBodyModel('r1').getValue()).toBe('persisted draft'));
  });

  it('does not send text typed while changes are discarded', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r1');
    type(getBodyModel('r1'), 'changed');
    await loadEditorContentFor('saved');

    const discarded = ctx.store.getState().discardChanges();
    // the editor content is only reloaded once main discarded the changes
    type(getBodyModel('r1'), 'typed meanwhile');
    await expect(discarded).resolves.toBe(true);
    await flushModelEdits('r1');

    expect(ctx.commands()).toEqual([
      { type: CommandType.CREATE_DRAFT, id: 'r1' },
      { type: CommandType.DISCARD_REQUEST, id: 'r1' },
    ]);
    expect(ctx.store.getState().requests.get('r1')!.draft).toBe(false);
    expect(getBodyModel('r1').getValue()).toBe('saved');
  });

  it('does not send text typed while changes are discarded, even if it is flushed meanwhile', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r1');
    type(getBodyModel('r1'), 'changed');
    await loadEditorContentFor('saved');
    let releaseDiscard!: () => void;
    const dispatch = ctx.main.dispatch;
    ctx.main.dispatch = async (envelope) => {
      if (envelope.command.type === CommandType.DISCARD_REQUEST) {
        await new Promise<void>((resolve) => (releaseDiscard = resolve));
      }
      return await dispatch(envelope);
    };

    const discarded = ctx.store.getState().discardChanges();
    // the debounce timer of this text fires before main discarded the changes
    type(getBodyModel('r1'), 'typed meanwhile');
    await flushModelEdits('r1');
    releaseDiscard();
    await expect(discarded).resolves.toBe(true);

    expect(ctx.commands()).toEqual([
      { type: CommandType.CREATE_DRAFT, id: 'r1' },
      { type: CommandType.DISCARD_REQUEST, id: 'r1' },
    ]);
    expect(ctx.store.getState().requests.get('r1')!.draft).toBe(false);
  });

  it('shows an error and reloads the editor content if a debounced edit is rejected', async () => {
    vi.useFakeTimers();
    try {
      const ctx = setup();
      ctx.store.getState().setSelectedRequest('r1');
      type(getBodyModel('r1'), 'not persisted');
      ctx.main.rejectNext = new Error('rejected');

      await vi.advanceTimersByTimeAsync(MODEL_EDIT_DEBOUNCE_MS);

      expect(ctx.commands()).toEqual([
        { type: CommandType.CREATE_DRAFT, id: 'r1' },
        { type: CommandType.SET_TEXT_BODY, id: 'r1', text: 'not persisted' },
      ]);
      expect(showError).toHaveBeenCalledWith(expect.any(String), expect.any(Error));
      expect(loadEditorContent).toHaveBeenCalledWith('r1', { only: 'body' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not mark a draft request as draft again', async () => {
    const ctx = setup();
    ctx.store.getState().setSelectedRequest('r1');
    ctx.store.getState().updateRequest({ method: RequestMethod.PUT });

    type(getBodyModel('r1'), 'body');
    await flushModelEdits('r1');

    expect(ctx.commands().map(({ type }) => type)).toEqual([
      CommandType.EDIT_REQUEST,
      CommandType.SET_TEXT_BODY,
    ]);
  });
});

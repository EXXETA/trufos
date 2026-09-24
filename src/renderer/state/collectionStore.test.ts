import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCollectionStore } from './collectionStore';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { isRequestInAParentFolder } from '@/state/helper/collectionUtil';
import { ClientCertificate, Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { AuthorizationType, OAuth2Method } from 'shim/objects';

const mockEventService = RendererEventService.instance as unknown as {
  deleteObject: ReturnType<typeof vi.fn>;
  copyRequest: ReturnType<typeof vi.fn>;
  copyFolder: ReturnType<typeof vi.fn>;
  loadCollection: ReturnType<typeof vi.fn>;
};

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: { open: vi.fn() },
}));

vi.mock('@/state/helper/collectionUtil', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./helper/collectionUtil')>();
  return {
    ...actual,
    isRequestInAParentFolder: vi.fn(() => false),
  };
});

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      rename: vi.fn(),
      setClientCertificate: vi.fn(),
      deleteObject: vi.fn().mockResolvedValue(undefined),
      copyRequest: vi.fn().mockResolvedValue(undefined),
      copyFolder: vi.fn().mockResolvedValue(undefined),
      loadCollection: vi.fn(),
    },
  },
}));

vi.mock('@/state/variableStore', () => ({
  useVariableStore: { getState: () => ({ initialize: vi.fn() }) },
}));

vi.mock('@/state/environmentStore', () => ({
  useEnvironmentStore: { getState: () => ({ initialize: vi.fn() }) },
}));

const makeRequest = (id: string, parentId: string): TrufosRequest =>
  ({
    id,
    parentId,
    type: 'request',
    title: id,
    url: { base: 'http://localhost', query: [] },
    method: RequestMethod.GET,
    headers: [],
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    draft: false,
  }) as unknown as TrufosRequest;

const makeCollection = (id: string, children: Collection['children'] = []): Collection =>
  ({
    id,
    parentId: null,
    type: 'collection',
    title: 'Test',
    dirPath: '/test',
    children,
    variables: [],
    environments: [],
  }) as unknown as Collection;

const REQ_ID = 'req-1';
const COL_ID = 'col-1';

const buildStore = () => {
  const request = makeRequest(REQ_ID, COL_ID);
  const collection = makeCollection(COL_ID, [request]);
  const store = createCollectionStore(collection);
  store.getState().setSelectedRequest(REQ_ID);
  return store;
};

describe('markDraft', () => {
  it('setDraftFlag sets draft and updates lastModified', () => {
    const store = buildStore();
    const before = Date.now();

    store.getState().setDraftFlag();

    const state = store.getState();
    expect(state.requests.get(REQ_ID)!.draft).toBe(true);
    expect(state.requests.get(REQ_ID)!.lastModified).toBeGreaterThanOrEqual(before);
  });

  it('updateHeader sets draft and updates lastModified', () => {
    const store = buildStore();
    store.getState().addHeader();
    const before = Date.now();

    store.getState().updateHeader(0, { key: 'X-Test', value: '1', isActive: true });

    const state = store.getState();
    expect(state.requests.get(REQ_ID)!.draft).toBe(true);
    expect(state.requests.get(REQ_ID)!.lastModified).toBeGreaterThanOrEqual(before);
  });

  it('addHeader sets draft and updates lastModified', () => {
    const store = buildStore();
    const before = Date.now();

    store.getState().addHeader();

    const state = store.getState();
    expect(state.requests.get(REQ_ID)!.draft).toBe(true);
    expect(state.requests.get(REQ_ID)!.lastModified).toBeGreaterThanOrEqual(before);
  });

  it('deleteHeader sets draft and updates lastModified', () => {
    const store = buildStore();
    store.getState().addHeader();
    const before = Date.now();

    store.getState().deleteHeader(0);

    const state = store.getState();
    expect(state.requests.get(REQ_ID)!.draft).toBe(true);
    expect(state.requests.get(REQ_ID)!.lastModified).toBeGreaterThanOrEqual(before);
  });

  it('updateQueryParam sets draft and updates lastModified', () => {
    const store = buildStore();
    store.getState().addQueryParam();
    const before = Date.now();

    store.getState().updateQueryParam(0, { key: 'foo', value: 'bar' });

    const state = store.getState();
    expect(state.requests.get(REQ_ID)!.draft).toBe(true);
    expect(state.requests.get(REQ_ID)!.lastModified).toBeGreaterThanOrEqual(before);
  });

  it('updateAuthorization on a request sets draft and updates lastModified', () => {
    const store = buildStore();
    const before = Date.now();
    const request = store.getState().requests.get(REQ_ID);

    store.getState().updateAuthorization(request!, {
      type: AuthorizationType.BEARER,
      token: 'abc',
    });

    const state = store.getState();
    expect(state.requests.get(REQ_ID)!.draft).toBe(true);
    expect(state.requests.get(REQ_ID)!.lastModified).toBeGreaterThanOrEqual(before);
  });

  it('updateAuthorization merges fields when the type is unchanged', () => {
    const store = buildStore();
    const request = store.getState().requests.get(REQ_ID);

    store.getState().updateAuthorization(request!, { type: AuthorizationType.BASIC });
    store.getState().updateAuthorization(store.getState().requests.get(REQ_ID)!, {
      username: 'user',
    });

    expect(store.getState().requests.get(REQ_ID)!.auth).toEqual({
      type: AuthorizationType.BASIC,
      username: 'user',
    });
  });

  it('updateAuthorization drops stale fields when the type changes', () => {
    const store = buildStore();
    const request = store.getState().requests.get(REQ_ID);

    // Simulate a previous type whose discriminator fields must not leak into the next type.
    store.getState().updateAuthorization(request!, {
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.AUTHORIZATION_CODE,
    } as never);
    store.getState().updateAuthorization(store.getState().requests.get(REQ_ID)!, {
      type: AuthorizationType.OAUTH1,
    });

    // Only the new type remains — no stale `method` from OAuth2.
    expect(store.getState().requests.get(REQ_ID)!.auth).toEqual({ type: AuthorizationType.OAUTH1 });
  });
});

describe('renameRequest', () => {
  it('updates the request in the collection tree after previous edits replaced the map entry', async () => {
    const store = buildStore();

    store.getState().updateRequest({ url: { base: 'http://example.com', query: [] } });
    await store.getState().renameRequest(REQ_ID, 'Renamed request');

    const state = store.getState();
    expect(state.requests.get(REQ_ID)!.title).toBe('Renamed request');
    expect(state.collection!.children[0].title).toBe('Renamed request');
  });
});

describe('initialize', () => {
  it('preserves openFolders when reinitializing the same collection', () => {
    const store = buildStore();
    store.getState().setFolderOpen('folder-a');

    store.getState().initialize(makeCollection(COL_ID));

    expect(store.getState().openFolders.has('folder-a')).toBe(false); // pruned (folder not in new map)
  });

  it('retains an openFolders entry still present after reinitializing the same collection', () => {
    // Regression test: Immer draft Sets don't support Set.prototype.intersection() (it
    // silently returns empty), so this guards against a naive `.intersection()` call
    // wiping out still-valid open folders on every collection reload.
    const folder: Folder = {
      id: 'folder-a',
      parentId: COL_ID,
      type: 'folder',
      title: 'Folder A',
      children: [],
    } as unknown as Folder;
    const store = buildStore();
    store.getState().initialize(makeCollection(COL_ID, [folder]));
    store.getState().setFolderOpen('folder-a');

    store.getState().initialize(makeCollection(COL_ID, [folder]));

    expect(store.getState().openFolders.has('folder-a')).toBe(true);
  });

  it('resets openFolders and selectedRequestId when switching to a different collection', () => {
    const store = buildStore();
    store.getState().setFolderOpen('folder-a');

    store.getState().initialize(makeCollection('col-2'));

    const state = store.getState();
    expect(state.openFolders.size).toBe(0);
    expect(state.selectedRequestId).toBeUndefined();
  });

  it('keeps selectedRequestId when reinitializing with the same collection and request still exists', () => {
    const request = makeRequest(REQ_ID, COL_ID);
    const store = buildStore();

    store.getState().initialize(makeCollection(COL_ID, [request]));

    expect(store.getState().selectedRequestId).toBe(REQ_ID);
  });

  it('clears selectedRequestId when reinitializing and the selected request no longer exists', () => {
    const store = buildStore();

    store.getState().initialize(makeCollection(COL_ID, [])); // request removed

    expect(store.getState().selectedRequestId).toBeUndefined();
  });

  it('prunes selectedIds to ids still present when reinitializing the same collection', () => {
    const store = buildStore();
    store.getState().setSelection([REQ_ID, 'stale-id']);

    store.getState().initialize(makeCollection(COL_ID, [makeRequest(REQ_ID, COL_ID)]));

    const state = store.getState();
    expect(state.selectedIds.has(REQ_ID)).toBe(true);
    expect(state.selectedIds.has('stale-id')).toBe(false);
  });

  it('resets selectedIds when switching to a different collection', () => {
    const store = buildStore();
    store.getState().setSelection([REQ_ID]);

    store.getState().initialize(makeCollection('col-2'));

    expect(store.getState().selectedIds.size).toBe(0);
  });
});

describe('selection actions', () => {
  it('toggleItemSelected adds an id not yet selected', () => {
    const store = buildStore();

    store.getState().toggleItemSelected(REQ_ID);

    expect(store.getState().selectedIds.has(REQ_ID)).toBe(true);
  });

  it('toggleItemSelected removes an id already selected', () => {
    const store = buildStore();
    store.getState().toggleItemSelected(REQ_ID);

    store.getState().toggleItemSelected(REQ_ID);

    expect(store.getState().selectedIds.has(REQ_ID)).toBe(false);
  });

  it('setSelection replaces the entire selection', () => {
    const store = buildStore();
    store.getState().toggleItemSelected('other-id');

    store.getState().setSelection([REQ_ID, 'folder-a']);

    const state = store.getState();
    expect([...state.selectedIds].sort()).toEqual([REQ_ID, 'folder-a'].sort());
  });

  it('clearSelection empties the selection', () => {
    const store = buildStore();
    store.getState().setSelection([REQ_ID, 'folder-a']);

    store.getState().clearSelection();

    expect(store.getState().selectedIds.size).toBe(0);
  });
});

const makeFolder = (id: string, parentId: string, children: Folder['children'] = []): Folder =>
  ({
    id,
    parentId,
    type: 'folder',
    title: id,
    children,
  }) as unknown as Folder;

describe('deleteSelectedItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventService.deleteObject.mockResolvedValue(undefined);
  });

  it('deletes each top-level selected item via eventService.deleteObject, reloads exactly once, and clears the selection', async () => {
    const request = makeRequest(REQ_ID, COL_ID);
    const folder = makeFolder('folder-a', COL_ID);
    const store = createCollectionStore(makeCollection(COL_ID, [request, folder]));
    mockEventService.loadCollection.mockResolvedValue(makeCollection(COL_ID, []));

    store.getState().setSelection([REQ_ID, 'folder-a']);
    await store.getState().deleteSelectedItems();

    expect(mockEventService.deleteObject).toHaveBeenCalledWith(request);
    expect(mockEventService.deleteObject).toHaveBeenCalledWith(folder);
    expect(mockEventService.loadCollection).toHaveBeenCalledTimes(1);
    expect(store.getState().selectedIds.size).toBe(0);
  });

  it("excludes a selected folder's own selected descendant from the delete loop", async () => {
    const childReq = makeRequest('child-req', 'folder-a');
    const folder = makeFolder('folder-a', COL_ID, [childReq]);
    const store = createCollectionStore(makeCollection(COL_ID, [folder]));
    mockEventService.loadCollection.mockResolvedValue(makeCollection(COL_ID, []));

    store.getState().setSelection(['folder-a', 'child-req']);
    await store.getState().deleteSelectedItems();

    expect(mockEventService.deleteObject).toHaveBeenCalledTimes(1);
    expect(mockEventService.deleteObject).toHaveBeenCalledWith(folder);
    expect(mockEventService.loadCollection).toHaveBeenCalledTimes(1);
  });

  it('disposes the open request before reloading when it is a descendant of a bulk-deleted folder', async () => {
    const childReq = makeRequest('child-req', 'folder-a');
    const folder = makeFolder('folder-a', COL_ID, [childReq]);
    const store = createCollectionStore(makeCollection(COL_ID, [folder]));
    store.getState().setSelectedRequest('child-req');
    vi.mocked(isRequestInAParentFolder).mockReturnValueOnce(true);
    mockEventService.loadCollection.mockResolvedValue(makeCollection(COL_ID, []));

    const setSelectedRequestMock = vi.fn(store.getState().setSelectedRequest);
    store.setState({ setSelectedRequest: setSelectedRequestMock });

    store.getState().setSelection(['folder-a']);
    await store.getState().deleteSelectedItems();

    expect(setSelectedRequestMock).toHaveBeenCalledWith(undefined);
    expect(store.getState().selectedRequestId).toBeUndefined();
  });
});

describe('duplicateSelectedItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventService.copyRequest.mockResolvedValue(undefined);
    mockEventService.copyFolder.mockResolvedValue(undefined);
  });

  it('duplicates each top-level selected item via eventService.copyRequest/copyFolder, reloads exactly once, and clears the selection', async () => {
    const request = makeRequest(REQ_ID, COL_ID);
    const folder = makeFolder('folder-a', COL_ID);
    const store = createCollectionStore(makeCollection(COL_ID, [request, folder]));
    mockEventService.loadCollection.mockResolvedValue(makeCollection(COL_ID, [request, folder]));

    store.getState().setSelection([REQ_ID, 'folder-a']);
    await store.getState().duplicateSelectedItems();

    expect(mockEventService.copyRequest).toHaveBeenCalledWith(request);
    expect(mockEventService.copyFolder).toHaveBeenCalledWith(folder);
    expect(mockEventService.loadCollection).toHaveBeenCalledTimes(1);
    expect(store.getState().selectedIds.size).toBe(0);
  });

  it("excludes a selected folder's own selected descendant from the duplicate loop", async () => {
    const childReq = makeRequest('child-req', 'folder-a');
    const folder = makeFolder('folder-a', COL_ID, [childReq]);
    const store = createCollectionStore(makeCollection(COL_ID, [folder]));
    mockEventService.loadCollection.mockResolvedValue(makeCollection(COL_ID, [folder]));

    store.getState().setSelection(['folder-a', 'child-req']);
    await store.getState().duplicateSelectedItems();

    expect(mockEventService.copyFolder).toHaveBeenCalledTimes(1);
    expect(mockEventService.copyFolder).toHaveBeenCalledWith(folder);
    expect(mockEventService.copyRequest).not.toHaveBeenCalled();
    expect(mockEventService.loadCollection).toHaveBeenCalledTimes(1);
  });
});

describe('setClientCertificate', () => {
  const CERT: ClientCertificate = {
    certPath: '/path/to/cert.pem',
    keyPath: '/path/to/key.pem',
    caPath: '/path/to/ca.pem',
  };

  it('sets the client certificate on the collection', () => {
    const store = createCollectionStore(makeCollection(COL_ID));

    store.getState().setClientCertificate(CERT);

    expect(store.getState().collection?.clientCertificate).toEqual(CERT);
  });

  it('clears the client certificate when called with null', () => {
    const store = createCollectionStore(makeCollection(COL_ID));
    store.getState().setClientCertificate(CERT);

    store.getState().setClientCertificate(null);

    expect(store.getState().collection?.clientCertificate).toBeUndefined();
  });

  it('replaces an existing certificate with a new one', () => {
    const store = createCollectionStore(makeCollection(COL_ID));
    store.getState().setClientCertificate(CERT);

    const newCert: ClientCertificate = { certPath: '/new/cert.pem', keyPath: '/new/key.pem' };
    store.getState().setClientCertificate(newCert);

    expect(store.getState().collection?.clientCertificate).toEqual(newCert);
  });
});

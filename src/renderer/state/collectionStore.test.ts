import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCollectionStore } from './collectionStore';
import { ClientCertificate, Collection } from 'shim/objects/collection';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: { open: vi.fn() },
}));

vi.mock('@/state/helper/collectionUtil', () => ({
  isRequestInAParentFolder: vi.fn(() => false),
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: {} },
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

const makeCollection = (id: string, children: TrufosRequest[] = []): Collection =>
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
    expect(state.requests.get(REQ_ID).draft).toBe(true);
    expect(state.requests.get(REQ_ID).lastModified).toBeGreaterThanOrEqual(before);
  });

  it('updateHeader sets draft and updates lastModified', () => {
    const store = buildStore();
    store.getState().addHeader();
    const before = Date.now();

    store.getState().updateHeader(0, { key: 'X-Test', value: '1', isActive: true });

    const state = store.getState();
    expect(state.requests.get(REQ_ID).draft).toBe(true);
    expect(state.requests.get(REQ_ID).lastModified).toBeGreaterThanOrEqual(before);
  });

  it('addHeader sets draft and updates lastModified', () => {
    const store = buildStore();
    const before = Date.now();

    store.getState().addHeader();

    const state = store.getState();
    expect(state.requests.get(REQ_ID).draft).toBe(true);
    expect(state.requests.get(REQ_ID).lastModified).toBeGreaterThanOrEqual(before);
  });

  it('deleteHeader sets draft and updates lastModified', () => {
    const store = buildStore();
    store.getState().addHeader();
    const before = Date.now();

    store.getState().deleteHeader(0);

    const state = store.getState();
    expect(state.requests.get(REQ_ID).draft).toBe(true);
    expect(state.requests.get(REQ_ID).lastModified).toBeGreaterThanOrEqual(before);
  });

  it('updateQueryParam sets draft and updates lastModified', () => {
    const store = buildStore();
    store.getState().addQueryParam();
    const before = Date.now();

    store.getState().updateQueryParam(0, { key: 'foo', value: 'bar' });

    const state = store.getState();
    expect(state.requests.get(REQ_ID).draft).toBe(true);
    expect(state.requests.get(REQ_ID).lastModified).toBeGreaterThanOrEqual(before);
  });

  it('updateAuthorization on a request sets draft and updates lastModified', () => {
    const store = buildStore();
    const before = Date.now();
    const request = store.getState().requests.get(REQ_ID);

    store.getState().updateAuthorization(request, { type: 'bearer', token: 'abc' } as any);

    const state = store.getState();
    expect(state.requests.get(REQ_ID).draft).toBe(true);
    expect(state.requests.get(REQ_ID).lastModified).toBeGreaterThanOrEqual(before);
  });
});

describe('initialize', () => {
  it('preserves openFolders when reinitializing the same collection', () => {
    const store = buildStore();
    store.getState().setFolderOpen('folder-a');

    store.getState().initialize(makeCollection(COL_ID));

    expect(store.getState().openFolders.has('folder-a')).toBe(false); // pruned (folder not in new map)
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

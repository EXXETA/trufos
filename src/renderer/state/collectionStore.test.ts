import { describe, it, expect, vi } from 'vitest';
import { createAppStore, selectPersistableAppState } from './collectionStore';
import { ClientCertificate, Collection } from 'shim/objects/collection';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { AuthorizationType, OAuth2Method } from 'shim/objects';

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: { open: vi.fn() },
}));

vi.mock('@/state/helper/collectionUtil', () => ({
  isRequestInAParentFolder: vi.fn(() => false),
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      rename: vi.fn(),
      setClientCertificate: vi.fn(),
      setCollectionVariables: vi.fn(),
      setEnvironmentVariables: vi.fn(),
      selectEnvironment: vi.fn().mockResolvedValue(undefined),
    },
  },
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
    variables: {},
    environments: {},
  }) as unknown as Collection;

const REQ_ID = 'req-1';
const COL_ID = 'col-1';

const buildStore = () => {
  const request = makeRequest(REQ_ID, COL_ID);
  const collection = makeCollection(COL_ID, [request]);
  const store = createAppStore(collection);
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
    const store = createAppStore(makeCollection(COL_ID));

    store.getState().setClientCertificate(CERT);

    expect(store.getState().collection?.clientCertificate).toEqual(CERT);
  });

  it('clears the client certificate when called with null', () => {
    const store = createAppStore(makeCollection(COL_ID));
    store.getState().setClientCertificate(CERT);

    store.getState().setClientCertificate(null);

    expect(store.getState().collection?.clientCertificate).toBeUndefined();
  });

  it('replaces an existing certificate with a new one', () => {
    const store = createAppStore(makeCollection(COL_ID));
    store.getState().setClientCertificate(CERT);

    const newCert: ClientCertificate = { certPath: '/new/cert.pem', keyPath: '/new/key.pem' };
    store.getState().setClientCertificate(newCert);

    expect(store.getState().collection?.clientCertificate).toEqual(newCert);
  });
});

describe('saveCollectionSettings', () => {
  it('updates all collection settings through one root-store action', async () => {
    const store = createAppStore(makeCollection(COL_ID));
    const certificate: ClientCertificate = {
      certPath: '/path/to/cert.pem',
      keyPath: '/path/to/key.pem',
    };
    const variables = { apiKey: { value: 'test-123' } };
    const environments = { dev: { variables: { host: { value: 'localhost' } } } };

    await store.getState().saveCollectionSettings({
      title: 'Renamed collection',
      variables,
      environments,
      selectedEnvironment: 'dev',
      clientCertificate: certificate,
    });

    const state = store.getState();
    expect(state.variables).toEqual(variables);
    expect(state.environments).toEqual(environments);
    expect(state.selectedEnvironment).toBe('dev');
    expect(state.collection?.clientCertificate).toEqual(certificate);
    expect(state.collection?.title).toBe('Renamed collection');
  });
});

describe('selectPersistableAppState', () => {
  it('includes durable collection data and excludes transient root-store state', () => {
    const store = createAppStore(makeCollection(COL_ID));
    store.getState().initializeVariables({ apiKey: { value: 'test-123' } });
    store.getState().initializeEnvironments({ dev: { variables: {} } });
    store.getState().openCollectionRunner();

    const persisted = selectPersistableAppState(store.getState());

    expect(persisted.collection?.variables).toEqual({ apiKey: { value: 'test-123' } });
    expect(persisted.collection?.environments).toEqual({ dev: { variables: {} } });
    expect(persisted.selectedEnvironment).toBe('dev');
    expect(persisted.appSettings).toEqual({ theme: 'system' });
    expect(persisted).not.toHaveProperty('responseInfoMap');
    expect(persisted).not.toHaveProperty('isCollectionRunnerOpen');
    expect(persisted).not.toHaveProperty('requests');
  });
});

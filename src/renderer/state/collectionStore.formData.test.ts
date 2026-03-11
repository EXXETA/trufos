import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCollectionStore, selectFormDataFields } from './collectionStore';
import { Collection } from 'shim/objects/collection';
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
    body: { type: RequestBodyType.FORM_DATA, fields: [] },
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

describe('FormData store actions', () => {
  let store: ReturnType<typeof buildStore>;

  beforeEach(() => {
    store = buildStore();
  });

  describe('addFormDataField', () => {
    it('adds a new text field with empty key', () => {
      store.getState().addFormDataField();

      const fields = (store.getState().requests.get(REQ_ID)!.body as any).fields;
      expect(fields).toHaveLength(1);
      expect(fields[0].key).toBe('');
      expect(fields[0].value.type).toBe(RequestBodyType.TEXT);
    });

    it('sets draft when adding a field', () => {
      store.getState().addFormDataField();

      expect(store.getState().requests.get(REQ_ID)!.draft).toBe(true);
    });

    it('accumulates multiple fields', () => {
      store.getState().addFormDataField();
      store.getState().addFormDataField();
      store.getState().addFormDataField();

      const fields = (store.getState().requests.get(REQ_ID)!.body as any).fields;
      expect(fields).toHaveLength(3);
    });
  });

  describe('updateFormDataField', () => {
    beforeEach(() => {
      store.getState().addFormDataField();
    });

    it('updates the key of an existing field', () => {
      store.getState().updateFormDataField(0, { key: 'username' });

      const fields = (store.getState().requests.get(REQ_ID)!.body as any).fields;
      expect(fields[0].key).toBe('username');
    });

    it('updates value to file type', () => {
      store.getState().updateFormDataField(0, {
        value: { type: RequestBodyType.FILE, filePath: '/tmp/file.txt', fileName: 'file.txt' },
      });

      const fields = (store.getState().requests.get(REQ_ID)!.body as any).fields;
      expect(fields[0].value.type).toBe(RequestBodyType.FILE);
      expect(fields[0].value.filePath).toBe('/tmp/file.txt');
    });

    it('sets draft when updating a field', () => {
      store.getState().updateFormDataField(0, { key: 'changed' });

      expect(store.getState().requests.get(REQ_ID)!.draft).toBe(true);
    });
  });

  describe('deleteFormDataField', () => {
    beforeEach(() => {
      store.getState().addFormDataField();
      store.getState().updateFormDataField(0, { key: 'first' });
      store.getState().addFormDataField();
      store.getState().updateFormDataField(1, { key: 'second' });
    });

    it('removes the field at the given index', () => {
      store.getState().deleteFormDataField(0);

      const fields = (store.getState().requests.get(REQ_ID)!.body as any).fields;
      expect(fields).toHaveLength(1);
      expect(fields[0].key).toBe('second');
    });

    it('sets draft when deleting a field', () => {
      store.getState().deleteFormDataField(0);

      expect(store.getState().requests.get(REQ_ID)!.draft).toBe(true);
    });
  });

  describe('deleteSelectedFormDataFields', () => {
    beforeEach(() => {
      ['a', 'b', 'c', 'd'].forEach((key, i) => {
        store.getState().addFormDataField();
        store.getState().updateFormDataField(i, { key });
      });
    });

    it('removes only the selected indices', () => {
      store.getState().deleteSelectedFormDataFields(new Set([0, 2]));

      const fields = (store.getState().requests.get(REQ_ID)!.body as any).fields;
      expect(fields.map((f: any) => f.key)).toEqual(['b', 'd']);
    });

    it('removes all fields when all indices are selected', () => {
      store.getState().deleteSelectedFormDataFields(new Set([0, 1, 2, 3]));

      const fields = (store.getState().requests.get(REQ_ID)!.body as any).fields;
      expect(fields).toHaveLength(0);
    });

    it('keeps all fields when selection is empty', () => {
      store.getState().deleteSelectedFormDataFields(new Set());

      const fields = (store.getState().requests.get(REQ_ID)!.body as any).fields;
      expect(fields).toHaveLength(4);
    });
  });

  describe('selectFormDataFields', () => {
    it('returns empty array when body is not form-data', () => {
      store.getState().setRequestBody({ type: RequestBodyType.TEXT, mimeType: 'text/plain' });

      const fields = selectFormDataFields(store.getState() as any);
      expect(fields).toEqual([]);
    });

    it('returns fields array when body is form-data', () => {
      store.getState().addFormDataField();
      store.getState().updateFormDataField(0, { key: 'foo' });

      const fields = selectFormDataFields(store.getState() as any);
      expect(fields).toHaveLength(1);
      expect(fields[0].key).toBe('foo');
    });
  });
});

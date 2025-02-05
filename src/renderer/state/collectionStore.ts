import { editor } from 'monaco-editor';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { RequestMethod } from 'shim/objects/request-method';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { TrufosHeader } from 'shim/objects/headers';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useActions } from '@/state/util';
import { TrufosObject } from 'shim/objects';
import { Collection } from 'shim/objects/collection';

const eventService = RendererEventService.instance;
eventService.on('before-close', async () => {
  console.info('Saving currently opened request before closing');
  const state = useCollectionStore.getState();
  const request = selectRequest(state);
  if (request != null && request.draft) {
    console.debug(`Saving request with ID ${request.id}`);
    await eventService.saveRequest(
      request,
      useCollectionStore.getState().requestEditor?.getValue()
    );
  }
  eventService.emit('ready-to-close');
});

type CollectionItem = Collection['children'][number];
type ParentItem = Exclude<TrufosObject, TrufosRequest>;

interface CollectionState {
  collection?: Omit<Collection, 'dirPath' | 'type'>;

  items: Map<CollectionItem['id'], CollectionItem>;

  /** The ID of the currently selected request */
  selectedRequestId?: TrufosRequest['id'];

  /** The editor instance for text-based request bodies */
  requestEditor?: editor.ICodeEditor;
}

interface CollectionStateActions {
  initialize(collection: Collection): void;

  addNewRequest(title?: string, parentId?: string): Promise<void>;

  /**
   * Replace the current request with the updated request
   * @param request The new request content
   * @param overwrite DEFAULT: `false`. If true, the request will be replaced with the updated request instead of merging it
   */
  updateRequest(request: TrufosRequest, overwrite: true): void;

  /**
   * Merge the current request with the updated request. This will also set the draft flag on the request
   * @param request The properties to update
   * @param overwrite DEFAULT: `false`. If true, the request will be replaced with the updated request instead of merging it
   */
  updateRequest(request: Partial<TrufosRequest>, overwrite?: false): void;

  setRequestBody(payload: RequestBody): void;

  setRequestEditor(requestEditor?: editor.ICodeEditor): void;

  setSelectedRequest(id?: TrufosRequest['id']): Promise<void>;

  deleteRequest(id: TrufosRequest['id']): Promise<void>;

  addHeader(): void;

  /**
   * Update a header in the currently selected request
   * @param index The index of the header to update
   * @param updatedHeader The new header content
   */
  updateHeader(index: number, updatedHeader: Partial<TrufosHeader>): void;

  /**
   * Delete a header from the currently selected request
   * @param index The index of the header to delete
   */
  deleteHeader(index: number): void;

  /**
   * Clear all headers from the currently selected request and add a new empty header
   */
  clearHeaders(): void;

  /**
   * Set the draft flag on the currently selected request
   */
  setDraftFlag(): void;
}

export const useCollectionStore = create<CollectionState & CollectionStateActions>()(
  immer((set, get) => ({
    items: new Map(),

    initialize: (collection) => {
      const items = new Map<CollectionItem['id'], CollectionItem>();
      const stack: CollectionItem[] = [...collection.children];
      while (stack.length > 0) {
        const current = stack.pop()!;
        items.set(current.id, current);
        if (current.type === 'folder') {
          stack.push(...current.children);
        }
      }

      set({ collection, items });
    },

    addNewRequest: async (title, parentId) => {
      const { collection } = get();
      const request = await eventService.saveRequest({
        url: 'http://',
        method: RequestMethod.GET,
        draft: true,
        id: null,
        parentId: parentId ?? collection.id,
        type: 'request',
        title: title ?? (Math.random() + 1).toString(36).substring(7),
        headers: [],
        body: {
          type: RequestBodyType.TEXT,
          mimeType: 'text/plain',
        },
      });

      set((state) => {
        state.items.set(request.id, request);
        const parent = state.items.get(request.parentId) as ParentItem;
        parent.children.push(request);
      });
    },

    updateRequest: (updatedRequest: Partial<TrufosRequest>, overwrite = false) =>
      set((state) => {
        const request = selectRequest(state);
        if (request == null) return;

        if (overwrite) {
          state.items.set(state.selectedRequestId, updatedRequest as TrufosRequest);
        } else {
          state.items.set(state.selectedRequestId, {
            ...request,
            draft: true,
            ...updatedRequest,
          });
        }
      }),

    setRequestBody: (body) => {
      const { updateRequest } = get();
      updateRequest({ body });
    },

    setRequestEditor: (requestEditor) => set({ requestEditor }),

    setSelectedRequest: async (id?: TrufosRequest['id']) => {
      const state = get();
      const { selectedRequestId, requestEditor } = state;
      if (selectedRequestId === id) return;

      const request = selectRequest(state);
      if (request != null && requestEditor != null) {
        await eventService.saveRequest(request, requestEditor.getValue());
      }
      set({ selectedRequestId: id });
    },

    deleteRequest: async (id: TrufosRequest['id']) => {
      await eventService.deleteObject(get().items.get(id));

      set((state) => {
        state.items.delete(id);
        if (state.selectedRequestId === id) delete state.selectedRequestId;
      });
    },

    addHeader: () =>
      set((state) => {
        selectHeaders(state).push({ key: '', value: '', isActive: false });
      }),

    updateHeader: (index: number, updatedHeader: Partial<TrufosHeader>) =>
      set((state) => {
        const headers = selectHeaders(state);
        headers[index] = { ...headers[index], ...updatedHeader };
      }),

    deleteHeader: (index: number) =>
      set((state) => {
        const headers = selectHeaders(state);
        headers.splice(index, 1);
        if (selectRequest(state).headers.length === 0) {
          state.addHeader();
        }
      }),

    clearHeaders: () =>
      set((state) => {
        const request = selectRequest(state);
        request.headers = [];
        state.addHeader();
      }),

    setDraftFlag: () =>
      set((state) => {
        selectRequest(state).draft = true;
      }),
  }))
);

export const selectRequest = (state: CollectionState) =>
  state.items.get(state.selectedRequestId) as TrufosRequest;
export const selectHeaders = (state: CollectionState) => selectRequest(state)?.headers;
export const useCollectionActions = () => useCollectionStore(useActions());

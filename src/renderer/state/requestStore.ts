import { RequestMethod } from 'shim/objects/request-method';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { editor } from 'monaco-editor';
import { TrufosHeader } from 'shim/objects/headers';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useActions } from '@/state/util';

const eventService = RendererEventService.instance;
eventService.on('before-close', async () => {
  console.info('Saving currently opened request before closing');
  const state = useRequestStore.getState();
  const request = selectRequest(state);
  if (request != null && request.draft) {
    console.debug(`Saving request with ID ${request.id}`);
    await eventService.saveRequest(request, state.requestEditor?.getValue());
  }
  eventService.emit('ready-to-close');
});

interface RequestState {
  requests: TrufosRequest[];
  selectedRequestIndex: number;
  collectionId: string;
  requestEditor?: editor.ICodeEditor;
}

interface RequestStateActions {
  initialize(state: Pick<RequestState, 'requests' | 'collectionId'>): void;

  addNewRequest(title?: string): Promise<void>;

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

  setSelectedRequest(index: number): Promise<void>;

  deleteRequest(index: number): Promise<void>;

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

export const useRequestStore = create<RequestState & RequestStateActions>()(
  immer((set, get) => ({
    requests: [],
    selectedRequestIndex: -1,
    collectionId: '',
    requestEditor: undefined,

    initialize: (state) =>
      set({
        requests: state.requests,
        collectionId: state.collectionId,
      }),

    addNewRequest: async (title) => {
      const { collectionId } = get();
      const request = await eventService.saveRequest({
        url: 'http://',
        method: RequestMethod.GET,
        draft: true,
        id: null,
        parentId: collectionId,
        type: 'request',
        title: title ?? (Math.random() + 1).toString(36).substring(7),
        headers: [],
        body: {
          type: RequestBodyType.TEXT,
          mimeType: 'text/plain',
        },
      });

      set((state) => {
        state.requests.push(request);
        state.selectedRequestIndex = state.requests.length - 1;
      });
    },

    updateRequest: (updatedRequest: Partial<TrufosRequest>, overwrite = false) =>
      set((state) => {
        const request = selectRequest(state);
        if (request == null) return;

        if (overwrite) {
          state.requests[state.selectedRequestIndex] = updatedRequest as TrufosRequest;
        } else {
          state.requests[state.selectedRequestIndex] = {
            ...request,
            draft: true,
            ...updatedRequest,
          };
        }
      }),

    setRequestBody: (body) => {
      const { updateRequest } = get();
      updateRequest({ body });
    },

    setRequestEditor: (requestEditor) => set({ requestEditor }),

    setSelectedRequest: async (index: number) => {
      const { selectedRequestIndex, requests, requestEditor } = get();
      if (selectedRequestIndex === index) return;
      const request = requests[selectedRequestIndex];
      if (request != null && requestEditor != null) {
        await eventService.saveRequest(request, requestEditor.getValue());
      }
      set({ selectedRequestIndex: index });
    },

    deleteRequest: async (index: number) => {
      await eventService.deleteObject(get().requests[index]);
      set((state) => {
        state.requests.splice(index, 1);
        if (state.selectedRequestIndex === index) {
          state.selectedRequestIndex = -1;
        } else if (state.selectedRequestIndex > index) {
          state.selectedRequestIndex--;
        }
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

export const selectRequest = (state: RequestState) => state.requests[state.selectedRequestIndex];
export const selectHeaders = (state: RequestState) => selectRequest(state)?.headers;
export const useRequestActions = () => useRequestStore(useActions());

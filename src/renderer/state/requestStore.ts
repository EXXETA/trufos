import { RequestMethod } from 'shim/objects/request-method';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { editor } from 'monaco-editor';
import { TrufosHeader } from 'shim/objects/headers';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface RequestState {
  requests: TrufosRequest[];
  selectedRequestIndex: number;
  collectionId: string;
  requestEditor?: editor.ICodeEditor;

  initialize: (payload: { requests: TrufosRequest[]; collectionId: string }) => void;
  addNewRequest: () => void;

  /**
   * Replace the current request with the updated request
   * @param request The new request content
   * @param overwrite DEFAULT: `false`. If true, the request will be replaced with the updated request instead of merging it
   */
  updateRequest(request: TrufosRequest, overwrite: true): void;

  /**
   * Merge the current request with the updated request
   * @param request The properties to update
   * @param overwrite DEFAULT: `false`. If true, the request will be replaced with the updated request instead of merging it
   */
  updateRequest(request: Partial<TrufosRequest>, overwrite?: false): void;

  setRequestBody: (payload: RequestBody) => void;
  setRequestEditor: (requestEditor?: editor.ICodeEditor) => void;
  setSelectedRequest: (index: number) => void;
  deleteRequest: (index: number) => void;
  addHeader: () => void;
  updateHeader: (payload: { index: number; updatedHeader: Partial<TrufosHeader> }) => void;
  deleteHeader: (index: number) => void;
  clearHeaders: () => void;
  setDraftFlag: () => void;
}

export const useRequestStore = create<RequestState>()(
  immer((set) => ({
    requests: [] as TrufosRequest[],
    selectedRequestIndex: 0,
    collectionId: '',
    requestEditor: undefined as undefined | editor.ICodeEditor,

    initialize: (payload: { requests: TrufosRequest[]; collectionId: string }) =>
      set({
        requests: payload.requests,
        collectionId: payload.collectionId,
      }),

    addNewRequest: (title?: string) =>
      set((state) => {
        state.requests.push({
          url: 'http://',
          method: RequestMethod.GET,
          draft: true,
          id: null,
          parentId: state.collectionId,
          type: 'request',
          title: title ?? (Math.random() + 1).toString(36).substring(7),
          headers: [],
          body: {
            type: RequestBodyType.TEXT,
            mimeType: 'text/plain',
          },
        });
        state.selectedRequestIndex = state.requests.length - 1;
      }),

    updateRequest: (updatedRequest: Partial<TrufosRequest>, overwrite = false) =>
      set(({ requests, selectedRequestIndex }) => {
        const currentRequest = requests[selectedRequestIndex];
        if (updatedRequest == null) return;

        requests[selectedRequestIndex] = overwrite
          ? (updatedRequest as TrufosRequest)
          : { ...currentRequest, ...updatedRequest };
      }),

    setRequestBody: (body: RequestBody) => set((state) => state.updateRequest({ body })),

    setRequestEditor: (requestEditor?: editor.ICodeEditor) => set({ requestEditor }),

    setSelectedRequest: (index: number) => set({ selectedRequestIndex: index }),

    deleteRequest: (index: number) =>
      set((state) => {
        const { requests, selectedRequestIndex } = state;
        if (requests.length === 1) {
          state.addNewRequest();
        } else if (selectedRequestIndex > 0 && selectedRequestIndex === index) {
          state.selectedRequestIndex--;
        }
        requests.splice(index, 1);
      }),

    addHeader: () =>
      set(({ requests, selectedRequestIndex }) => {
        requests[selectedRequestIndex].headers.push({ key: '', value: '', isActive: false });
      }),

    updateHeader: (payload: { index: number; updatedHeader: Partial<TrufosHeader> }) =>
      set((state) => {
        const { index, updatedHeader } = payload;
        const headers = selectHeaders(state);
        headers[index] = { ...headers[index], ...updatedHeader };
      }),

    deleteHeader: (index: number) =>
      set((state) => {
        const headers = selectHeaders(state);
        headers.splice(index, 1);
        if (state.requests[state.selectedRequestIndex].headers.length === 0) {
          state.addHeader();
        }
      }),

    clearHeaders: () =>
      set((state) => {
        const request = selectRequest(state);
        request.headers = [];
        state.addHeader();
      }),

    setDraftFlag: () => set((state) => (selectRequest(state).draft = true)),
  }))
);

export const selectRequest = (state: RequestState) => state.requests[state.selectedRequestIndex];
export const selectHeaders = (state: RequestState) => selectRequest(state)?.headers;

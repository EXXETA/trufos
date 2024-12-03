import { RequestMethod } from 'shim/objects/request-method';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { editor } from 'monaco-editor';
import { TrufosHeader } from 'shim/objects/headers';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface RequestState {
  requests: TrufosRequest[];
  selectedRequest: number;
  collectionId: string;
  requestEditor?: editor.ICodeEditor;
  requestBody?: RequestBody;
  initialize: (payload: { requests: TrufosRequest[]; collectionId: string }) => void;
  addNewRequest: () => void;
  updateRequest: (payload: { index: number; request: TrufosRequest }) => void;
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
    selectedRequest: 0,
    collectionId: '',
    requestEditor: undefined as undefined | editor.ICodeEditor,
    requestBody: undefined as undefined | RequestBody,
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
        state.selectedRequest = state.requests.length - 1;
      }),
    updateRequest: (payload: { index: number; request: TrufosRequest }) =>
      set(({ requests }) => {
        requests[payload.index] = payload.request;
      }),
    setRequestBody: (payload: RequestBody) =>
      set((state) => {
        const request = selectRequest(state);
        if (request != null) {
          request.body = payload;
        }
      }),
    setRequestEditor: (requestEditor?: editor.ICodeEditor) => set(() => ({ requestEditor })),
    setSelectedRequest: (index: number) => set(() => ({ selectedRequest: index })),
    deleteRequest: (index: number) =>
      set((state) => {
        const { requests, selectedRequest } = state;
        if (requests.length === 1) {
          state.addNewRequest();
        } else if (selectedRequest > 0 && selectedRequest === index) {
          state.selectedRequest--;
        }
        requests.splice(index, 1);
      }),
    addHeader: () =>
      set(({ requests, selectedRequest }) => {
        requests[selectedRequest].headers.push({ key: '', value: '', isActive: false });
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
        if (state.requests[state.selectedRequest].headers.length === 0) {
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

export const selectRequest = (state: RequestState) => state.requests[state.selectedRequest];
export const selectHeaders = (state: RequestState) => selectRequest(state)?.headers;

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RequestMethod } from 'shim/objects/request-method';
import { RequestBody, RequestBodyType, RufusRequest } from 'shim/objects/request';
import { editor } from 'monaco-editor';
import { RufusHeader } from 'shim/objects/headers';
import { RootState } from '@/state/store';

export const requestsSlice = createSlice({
  name: 'requests',
  initialState: {
    requests: [] as RufusRequest[],
    selectedRequest: 0,
    collectionId: '',
    requestEditor: undefined as undefined | editor.ICodeEditor,
    requestBody: undefined as undefined | RequestBody,
  },
  reducers: {
    initialize(state, action: PayloadAction<{ requests: RufusRequest[]; collectionId: string }>) {
      state.requests = action.payload.requests;
      state.collectionId = action.payload.collectionId;
    },
    addNewRequest(state) {
      state.requests.unshift({
        url: 'http://',
        method: RequestMethod.GET,
        draft: true,
        id: null,
        parentId: state.collectionId,
        type: 'request',
        title: (Math.random() + 1).toString(36).substring(7), // TODO: Let user set title
        headers: [],
        body: {
          type: RequestBodyType.TEXT,
          mimeType: 'text/plain',
        },
      });
      state.selectedRequest = 0;
    },
    updateRequest(state, action: PayloadAction<{ index: number; request: RufusRequest }>) {
      const { index, request } = action.payload;
      state.requests[index] = request;
    },
    setRequestBody(state, action: PayloadAction<RequestBody>) {
      const request = state.requests[state.selectedRequest];
      if (request != null) {
        request.body = action.payload;
      }
    },
    setRequestEditor: (state, action: PayloadAction<editor.ICodeEditor>) => {
      state.requestEditor = action.payload;
    },
    setSelectedRequest: (state, action: PayloadAction<number>) => {
      state.selectedRequest = action.payload;
    },
    deleteRequest(state, action: PayloadAction<number>) {
      state.requests.splice(action.payload, 1);
      if (state.selectedRequest >= state.requests.length && state.requests.length > 0) {
        state.selectedRequest = state.requests.length - 1;
      }
    },
    addHeader: (state) => {
      state.requests[state.selectedRequest].headers.push({ key: '', value: '', isActive: false });
    },
    updateHeader: (
      state,
      action: PayloadAction<{
        index: number;
        updatedHeader: Partial<RufusHeader>;
      }>
    ) => {
      const { index, updatedHeader } = action.payload;
      state.requests[state.selectedRequest].headers = state.requests[
        state.selectedRequest
      ].headers.toSpliced(index, 1, {
        ...state.requests[state.selectedRequest].headers[index],
        ...updatedHeader,
      });
    },
    deleteHeader: (state, action: PayloadAction<number>) => {
      state.requests[state.selectedRequest].headers = state.requests[
        state.selectedRequest
      ].headers.toSpliced(action.payload, 1);
      if (state.requests[state.selectedRequest].headers.length === 0) {
        requestsSlice.caseReducers.addHeader(state);
      }
    },
    clearHeaders: (state) => {
      state.requests[state.selectedRequest].headers = [];
      requestsSlice.caseReducers.addHeader(state);
    },
    setDraftFlag: (state, action: PayloadAction<boolean>) => {
      state.requests[state.selectedRequest].draft = action.payload ?? true;
    },
  },
});

export const selectRequest = (state: RootState) =>
  state.requests.requests[state.requests.selectedRequest];
export const selectHeaders = (state: RootState) => selectRequest(state).headers;

export const {
  updateRequest,
  addNewRequest,
  setSelectedRequest,
  deleteRequest,
  initialize,
  setRequestBody,
  setRequestEditor,
  addHeader,
  updateHeader,
  deleteHeader,
  clearHeaders,
  setDraftFlag,
} = requestsSlice.actions;

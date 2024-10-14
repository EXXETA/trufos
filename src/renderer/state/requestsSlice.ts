import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RequestMethod } from 'shim/objects/requestMethod';
import { RequestBodyType, RufusRequest } from 'shim/objects/request';

export const requestsSlice = createSlice({
  name: 'requests',
  initialState: {
    requests: [] as RufusRequest[],
    selectedRequest: 0,
    collectionId: ''
  },
  reducers: {
    initialize(state, action: PayloadAction<{ requests: RufusRequest[], collectionId: string }>) {
      state.requests = action.payload.requests;
      state.collectionId = action.payload.collectionId;
    },
    addNewRequest(state) {
      state.requests.unshift({
        url: 'http://',
        method: RequestMethod.get,
        draft: true,
        id: null,
        parentId: state.collectionId,
        type: 'request',
        title: (Math.random() + 1).toString(36).substring(7), // TODO: Let user set title
        headers: {},
        body: {
          type: RequestBodyType.TEXT,
          mimeType: 'text/plain'
        }
      });
      state.selectedRequest = 0;
    },
    updateRequest(state, action: PayloadAction<{ index: number; request: RufusRequest }>) {
      const { index, request } = action.payload;
      state.requests[index] = request;
      state.requests = [...state.requests];
    },
    setSelectedRequest: (state, action: PayloadAction<number>) => {
      state.selectedRequest = action.payload;
    },
    deleteRequest(state, action: PayloadAction<number>) {
      state.requests.splice(action.payload, 1);
      if (state.selectedRequest >= state.requests.length && state.requests.length > 0) {
        state.selectedRequest = state.requests.length - 1;
      }
    }
  }
});

export const {
  updateRequest,
  addNewRequest,
  setSelectedRequest,
  deleteRequest,
  initialize
} = requestsSlice.actions;

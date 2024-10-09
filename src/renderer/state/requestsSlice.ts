import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RequestMethod } from 'shim/objects/requestMethod';
import { RufusRequest } from 'shim/objects/request';

export const requestsSlice = createSlice({
  name: 'requests',
  initialState: {
    requests: [],
    selectedRequest: 0
  },
  reducers: {
    setRequests(state, action: PayloadAction<RufusRequest[]>) {
      state.requests = action.payload;
    },
    addNewRequest(state) {
      state.requests.unshift({
        url: 'New Request',
        method: RequestMethod.get,
        draft: true,
        id: '',
        parentId: '',
        type: 'request',
        title: '',
        headers: undefined,
        body: undefined
      });
      state.selectedRequest = 0;
    },
    updateRequest(state, action: PayloadAction<{ index: number; request: RufusRequest }>) {
      const { index, request } = action.payload;
      state.requests[index] = { ...request, draft: true };
    },
    setSelectedRequest: (state, action: PayloadAction<number>) => {
      state.selectedRequest = action.payload;
    },
    deleteRequest(state, action: PayloadAction<number>) {
      state.requests.splice(action.payload, 1);
      if (state.selectedRequest >= state.requests.length) {
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
  setRequests
} = requestsSlice.actions;

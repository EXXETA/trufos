import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RequestMethod } from 'shim/objects/requestMethod';
import { RequestBodyType, RufusRequest } from 'shim/objects/request';

interface RequestsState {
  requests: RufusRequest[];
  selectedRequest: number;
}

const initialState: RequestsState = {
  requests: [
    {
      method: RequestMethod.get, url: 'https://api.example.com/data', draft: false,
      id: '',
      parentId: '',
      type: 'request',
      title: '',
      headers: undefined,
      body: {
        type: RequestBodyType.TEXT,
        text: '',
        mimeType: ''
      }
    },
    {
      method: RequestMethod.post, url: 'https://api.example.com/data', draft: false,
      id: '',
      parentId: '',
      type: 'request',
      title: '',
      headers: undefined,
      body: {
        type: RequestBodyType.TEXT,
        text: '',
        mimeType: ''
      }
    },
    {
      method: RequestMethod.put, url: 'https://api.example.com/data/1', draft: false,
      id: '',
      parentId: '',
      type: 'request',
      title: '',
      headers: undefined,
      body: {
        type: RequestBodyType.TEXT,
        text: '',
        mimeType: ''
      }
    },
    {
      method: RequestMethod.delete, url: 'https://api.example.com/data/1', draft: false,
      id: '',
      parentId: '',
      type: 'request',
      title: '',
      headers: undefined,
      body: {
        type: RequestBodyType.TEXT,
        text: '',
        mimeType: ''
      }
    }
  ],
  selectedRequest: 0
};

export const requestsSlice = createSlice({
  name: 'requests',
  initialState,
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
  deleteRequest
} = requestsSlice.actions;

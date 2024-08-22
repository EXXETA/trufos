import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {Request} from 'shim/request';
import {RequestMethod} from 'shim/requestMethod';

interface RequestsState {
  requests: Request[];
  selectedRequest: number;
}

const initialState: RequestsState = {
  requests: [
    {method: RequestMethod.get, url: 'https://api.example.com/data'},
    {method: RequestMethod.post, url: 'https://api.example.com/data'},
    {method: RequestMethod.put, url: 'https://api.example.com/data/1'},
    {method: RequestMethod.delete, url: 'https://api.example.com/data/1'},
  ],
  selectedRequest: 0,
};

export const requestsSlice = createSlice({
  name: 'requests',
  initialState,
  reducers: {
    setRequests(state, action: PayloadAction<Request[]>) {
      state.requests = action.payload;
    },
    addRequest(state, action: PayloadAction<Request>) {
      state.requests.push(action.payload);
    },
    updateRequest(state, action: PayloadAction<{ index: number; request: Request }>) {
      const { index, request } = action.payload;
      state.requests[index] = request;
    },
    setSelectedRequest: (state, action: PayloadAction<number>) => {
      state.selectedRequest = action.payload;
    },
  },
});

export const {updateRequest, addRequest,setSelectedRequest} = requestsSlice.actions;

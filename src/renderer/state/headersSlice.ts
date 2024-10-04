import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {RootState} from '@/state/store';
import { RufusHeader } from '../../shim/objects/headers';

interface HeadersState {
  headers: RufusHeader[];
}

const initialState: HeadersState = {
  headers: [{ id: 0, key: '', value: '', isActive: false }],
};

const headersSlice = createSlice({
  name: 'headers',
  initialState,
  reducers: {
    addHeader: (state) => {
      const newHeader: RufusHeader = { id: Date.now(), key: '', value: '', isActive: false };
      state.headers.push(newHeader);
    },
    updateHeader: (state, action: PayloadAction<{ id: number; updatedHeader: Partial<RufusHeader> }>) => {
      const { id, updatedHeader } = action.payload;
      const index = state.headers.findIndex(header => header.id === id);
      if (index !== -1) {
        state.headers[index] = { ...state.headers[index], ...updatedHeader };
      }
    },
    deleteHeader: (state, action: PayloadAction<number>) => {
      if (state.headers.length === 1) {
        addHeader()
      } else {
        state.headers = state.headers.filter(header => header.id !== action.payload);
      }
    },
    clearHeaders: (state) => {
      state.headers = [];
      addHeader()
    },
  },
});

export const { addHeader, updateHeader, deleteHeader, clearHeaders } = headersSlice.actions;
export const selectHeaders = (state: RootState) => state.headers.headers;
export const headersReducer = headersSlice.reducer;

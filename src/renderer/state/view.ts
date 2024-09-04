import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import { editor } from 'monaco-editor';
import { RequestBody } from 'shim/objects/request';
import { RufusResponse } from '../../shim/objects/response';

export interface ViewState {
  requestEditor?: editor.ICodeEditor;
  requestBody?: RequestBody;
  response?: RufusResponse;
}

const initialState: ViewState = {};

export const viewSlice = createSlice({
  name: 'view',
  initialState,
  reducers: {
    setRequestEditor: (state, action: PayloadAction<editor.ICodeEditor>) => {
      state.requestEditor = action.payload;
    },
    setRequestBody: (state, action: PayloadAction<RequestBody>) => {
      state.requestBody = action.payload;
    }
  }
});

// Action creators are generated for each case reducer function
export const { setRequestEditor, setRequestBody } = viewSlice.actions;
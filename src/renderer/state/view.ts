import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import { editor } from 'monaco-editor';

export interface ViewState {
  requestEditor?: editor.ICodeEditor;
  response?: Response;
}

const initialState: ViewState = {};

export const viewSlice = createSlice({
  name: 'view',
  initialState,
  reducers: {
    setRequestEditor: (state, action: PayloadAction<editor.ICodeEditor>) => {
      state.requestEditor = action.payload;
    }
  }
});

// Action creators are generated for each case reducer function
export const { setRequestEditor } = viewSlice.actions;
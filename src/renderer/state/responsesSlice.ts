import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '@/state/store';
import { RufusResponse } from 'shim/objects/response';
import { selectRequest } from '@/state/requestsSlice';
import { editor } from 'monaco-editor';

declare type ResponseInfoMap = Record<string, RufusResponse>;

export const responsesSlice = createSlice({
  name: 'responses',
  initialState: {
    responseInfoMap: {} as ResponseInfoMap,
    editor: undefined as undefined | editor.ICodeEditor,
  },
  reducers: {
    addResponse(state, action: PayloadAction<RufusResponse & { requestId: string }>) {
      state.responseInfoMap[action.payload.requestId] = action.payload;
    },
    removeResponse(state, action: PayloadAction<string>) {
      delete state.responseInfoMap[action.payload];
    },
    setResponseEditor: (state, action: PayloadAction<editor.ICodeEditor | undefined>) => {
      state.editor = action.payload;
    },
  },
});

export const selectResponse = (state: RootState) =>
  state.responses.responseInfoMap[selectRequest(state)?.id];
export const selectResponseEditor = (state: RootState) => state.responses.editor;

export const { addResponse, removeResponse, setResponseEditor } = responsesSlice.actions;

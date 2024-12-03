import { TrufosResponse } from 'shim/objects/response';
import { editor } from 'monaco-editor';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/** A map of requestId => response */
type ResponseInfoMap = Record<string, TrufosResponse>;

interface ResponseState {
  responseInfoMap: ResponseInfoMap;
  editor?: editor.ICodeEditor;
  addResponse: (response: TrufosResponse & { requestId: string }) => void;
  removeResponse: (requestId: string) => void;
  setResponseEditor: (editor: editor.ICodeEditor | undefined) => void;
}

export const useResponseStore = create<ResponseState>()(
  immer((set) => ({
    responseInfoMap: {} as ResponseInfoMap,
    editor: undefined as undefined | editor.ICodeEditor,
    addResponse: (response) =>
      set((state) => {
        state.responseInfoMap[response.requestId] = response;
      }),
    removeResponse: (requestId) =>
      set((state) => {
        delete state.responseInfoMap[requestId];
      }),
    setResponseEditor: (responseEditor) => set({ editor: responseEditor }),
  }))
);

export const selectResponse = (state: ResponseState, requestId?: string) =>
  state.responseInfoMap[requestId];

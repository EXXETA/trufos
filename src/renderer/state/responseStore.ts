import { TrufosResponse } from 'shim/objects/response';
import { editor } from 'monaco-editor';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useRequestStore } from '@/state/requestStore';
import { useActions } from '@/state/util';

/** A map of requestId => response */
type ResponseInfoMap = Record<string, TrufosResponse>;

interface ResponseState {
  responseInfoMap: ResponseInfoMap;
  editor?: editor.ICodeEditor;
  addResponse: (requestId: string, response: TrufosResponse) => void;
  removeResponse: (requestId: string) => void;
  setResponseEditor: (editor: editor.ICodeEditor | undefined) => void;
}

export const useResponseStore = create<ResponseState>()(
  immer((set) => ({
    responseInfoMap: {},
    editor: undefined,
    addResponse: (requestId, response) =>
      set((state) => {
        state.responseInfoMap[requestId] = response;
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
export const useResponseActions = () => useResponseStore(useActions());

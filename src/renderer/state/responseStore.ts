import { useActions } from '@/state/helper/util';
import { editor } from 'monaco-editor';
import { TrufosResponse } from 'shim/objects/response';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/** A map of requestId => response */
type ResponseInfoMap = Record<string, TrufosResponse>;

interface ResponseState {
  responseInfoMap: ResponseInfoMap;
  editor?: editor.ICodeEditor;
  addResponse: (requestId: string, response: TrufosResponse) => void;
  removeResponse: (requestId: string) => void;
  setResponseEditor: (editor: editor.ICodeEditor | undefined) => void;

  /**
   * Format the text in the response editor.
   * This will only work if the response editor is set and the response body type is text-based.
   */
  formatResponseEditorText(): Promise<void>;
}

export const useResponseStore = create<ResponseState>()(
  immer((set, get) => ({
    responseInfoMap: {},
    addResponse: (requestId, response) =>
      set((state) => {
        state.responseInfoMap[requestId] = response;
      }),
    removeResponse: (requestId) =>
      set((state) => {
        delete state.responseInfoMap[requestId];
      }),
    setResponseEditor: (responseEditor) => set({ editor: responseEditor }),
    formatResponseEditorText: async () => {
      const responseEditor = get().editor;
      if (!responseEditor) return;

      try {
        responseEditor.updateOptions({ readOnly: false });
        await responseEditor.getAction('editor.action.formatDocument')?.run();
      } finally {
        responseEditor.updateOptions({ readOnly: true });
      }
    },
  }))
);

export const selectResponse = (state: ResponseState, requestId: string) =>
  state.responseInfoMap[requestId];
export const useResponseActions = () => useResponseStore(useActions());

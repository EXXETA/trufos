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
   * Format the text in the response editor and store the formatted response body in the response info map.
   * This will only work if the response editor is set and the response body type is text-based.
   * @param requestId The request ID of the request.
   */
  formatResponseBody(requestId: string): Promise<void>;
}

export const useResponseStore = create<ResponseState>()(
  immer((set, get) => ({
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
    formatResponseBody: async (requestId) => {
      const state = get();
      const responseEditor = state.editor;
      if (!responseEditor) return;

      try {
        responseEditor.updateOptions({ readOnly: false });
        await responseEditor.getAction('editor.action.formatDocument').run();
      } finally {
        responseEditor.updateOptions({ readOnly: true });
      }

      set((state) => {
        state.responseInfoMap[requestId].formattedResponseBody = state.editor.getValue();
      });
    },
  }))
);

export const selectResponse = (state: ResponseState, requestId: string) =>
  state.responseInfoMap[requestId];
export const useResponseActions = () => useResponseStore(useActions());

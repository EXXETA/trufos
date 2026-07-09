import { useActions } from '@/state/helper/util';
import { editor } from 'monaco-editor';
import { AssertionResult } from 'shim/objects/assertion';
import { TrufosResponse } from 'shim/objects/response';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/** A map of requestId => response */
type ResponseInfoMap = Record<string, TrufosResponse>;
type AssertionResultMap = Record<string, AssertionResult[]>;

// Stored outside immer state to prevent immer from deep-cloning the Monaco
// editor instance (which has circular references and would overflow the stack).
let responseEditorRef: editor.ICodeEditor | undefined;

interface ResponseState {
  responseInfoMap: ResponseInfoMap;
  assertionResultMap: AssertionResultMap;
  addResponse: (requestId: string, response: TrufosResponse) => void;
  setAssertionResults: (requestId: string, results: AssertionResult[]) => void;
  removeResponse: (requestId: string) => void;
  setResponseEditor: (editor: editor.ICodeEditor | undefined) => void;

  /**
   * Format the text in the response editor.
   * This will only work if the response editor is set and the response body type is text-based.
   */
  formatResponseEditorText(): Promise<void>;
}

export const useResponseStore = create<ResponseState>()(
  immer((set) => ({
    responseInfoMap: {},
    assertionResultMap: {},
    addResponse: (requestId, response) =>
      set((state) => {
        state.responseInfoMap[requestId] = response;
      }),
    setAssertionResults: (requestId, results) =>
      set((state) => {
        state.assertionResultMap[requestId] = results;
      }),
    removeResponse: (requestId) =>
      set((state) => {
        delete state.responseInfoMap[requestId];
        delete state.assertionResultMap[requestId];
      }),
    setResponseEditor: (responseEditor) => {
      responseEditorRef = responseEditor;
    },
    formatResponseEditorText: async () => {
      if (!responseEditorRef) return;

      try {
        responseEditorRef.updateOptions({ readOnly: false });
        await responseEditorRef.getAction('editor.action.formatDocument')?.run();
      } finally {
        responseEditorRef.updateOptions({ readOnly: true });
      }
    },
  }))
);

export const selectResponse = (state: ResponseState, requestId: string | undefined) =>
  requestId != null ? state.responseInfoMap[requestId] : undefined;
export const selectAssertionResults = (state: ResponseState, requestId: string | undefined) =>
  requestId != null ? state.assertionResultMap[requestId] : undefined;
export const useResponseActions = () => useResponseStore(useActions());

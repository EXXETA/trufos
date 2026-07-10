import { useActions } from '@/state/helper/util';
import { editor } from 'monaco-editor';
import { TrufosResponse } from 'shim/objects/response';
import { type ResponseState, useAppStore } from '@/state/appStore';

interface ResponseActions {
  addResponse: (requestId: string, response: TrufosResponse) => void;
  removeResponse: (requestId: string) => void;
  setResponseEditor: (editor: editor.ICodeEditor | undefined) => void;

  /**
   * Format the text in the response editor.
   * This will only work if the response editor is set and the response body type is text-based.
   */
  formatResponseEditorText(): Promise<void>;
}

type ResponseStoreState = ResponseState & ResponseActions;

export const useResponseStore = <T>(selector: (state: ResponseStoreState) => T): T =>
  useAppStore((state) =>
    selector({
      responseInfoMap: state.responseInfoMap,
      addResponse: state.addResponse,
      removeResponse: state.removeResponse,
      setResponseEditor: state.setResponseEditor,
      formatResponseEditorText: state.formatResponseEditorText,
    })
  );

export const selectResponse = (state: ResponseState, requestId: string | undefined) =>
  requestId != null ? state.responseInfoMap[requestId] : undefined;
export const useResponseActions = (): ResponseActions => useResponseStore(useActions());

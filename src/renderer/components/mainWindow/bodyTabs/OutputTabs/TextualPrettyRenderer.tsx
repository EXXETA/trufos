import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useResponseData,
  useResponseEditor,
  ResponseRenderer,
  getMimeType,
} from './PrettyRenderer';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { RESPONSE_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { getResponseModel } from '@/lib/monaco/models';
import { mimeTypeToLanguage } from '@/lib/monaco/language';
import { useCollectionStore } from '@/state/collectionStore';
import { editor } from 'monaco-editor';

export const TextualPrettyRenderer: ResponseRenderer = ({ response, maxBytes }) => {
  const { setEditorLanguage, formatResponseEditorText, setResponseEditor } = useResponseEditor();
  const language = useMemo(() => mimeTypeToLanguage(getMimeType(response)!), [response]);
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const editorRef = useRef<editor.ICodeEditor | undefined>(undefined);

  const onChange = useCallback(
    (content: string) => {
      if (selectedRequestId == null) return;
      getResponseModel(selectedRequestId).setValue(content);
      if (maxBytes == null) formatResponseEditorText();
    },
    [selectedRequestId, formatResponseEditorText, maxBytes]
  );

  useResponseData(response, 'utf-8', onChange, maxBytes);

  // Re-attach the correct model whenever the selected request changes.
  useEffect(() => {
    if (editorRef.current != null && selectedRequestId != null) {
      editorRef.current.setModel(getResponseModel(selectedRequestId));
    }
  }, [selectedRequestId]);

  useEffect(() => {
    if (selectedRequestId == null) return;
    const model = getResponseModel(selectedRequestId);
    setEditorLanguage(model.getLanguageId());
    const disposable = model.onDidChangeLanguage((e) => setEditorLanguage(e.newLanguage));
    return () => disposable.dispose();
  }, [language, selectedRequestId]);

  return (
    <MonacoEditor
      className="absolute h-full"
      language={language}
      options={RESPONSE_EDITOR_OPTIONS}
      onMount={(editorInstance) => {
        editorRef.current = editorInstance;
        if (selectedRequestId != null) {
          editorInstance.setModel(getResponseModel(selectedRequestId));
        }
        setResponseEditor(editorInstance);
      }}
    />
  );
};

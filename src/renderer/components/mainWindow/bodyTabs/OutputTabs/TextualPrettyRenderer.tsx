import { useCallback, useEffect, useMemo } from 'react';
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

export const TextualPrettyRenderer: ResponseRenderer = ({ response, maxBytes }) => {
  const { setEditorLanguage, formatResponseEditorText, setResponseEditor } = useResponseEditor();
  const language = useMemo(() => mimeTypeToLanguage(getMimeType(response)!), [response]);
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const responseModel = useMemo(() => getResponseModel(selectedRequestId!), [selectedRequestId]);

  const onChange = useCallback(
    (content: string) => {
      if (selectedRequestId == null) return;
      responseModel.setValue(content);
      if (maxBytes == null) formatResponseEditorText();
    },
    [responseModel, formatResponseEditorText, maxBytes]
  );

  useResponseData(response, 'utf-8', onChange, maxBytes);

  useEffect(() => {
    if (selectedRequestId == null) return;
    setEditorLanguage(responseModel.getLanguageId());
    const disposable = responseModel.onDidChangeLanguage((e) => setEditorLanguage(e.newLanguage));
    return () => disposable.dispose();
  }, [language, responseModel]);

  return (
    <MonacoEditor
      className="absolute h-full"
      language={language}
      options={{ ...RESPONSE_EDITOR_OPTIONS, model: responseModel }}
      onMount={setResponseEditor}
    />
  );
};

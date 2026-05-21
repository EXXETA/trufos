import { useEffect, useMemo } from 'react';
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

export const DefaultRenderer: ResponseRenderer = ({ response, maxBytes }) => {
  const { setEditorLanguage, setResponseEditor } = useResponseEditor();
  const language = useMemo(() => mimeTypeToLanguage(getMimeType(response)!), [response]);
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId)!;
  const responseModel = useMemo(() => getResponseModel(selectedRequestId), [selectedRequestId]);

  useResponseData(response, 'utf-8', (content) => responseModel.setValue(content), maxBytes);

  useEffect(() => {
    setEditorLanguage(responseModel.getLanguageId());
    const disposable = responseModel.onDidChangeLanguage((e) => setEditorLanguage(e.newLanguage));
    return () => disposable.dispose();
  }, [language, responseModel]);

  return (
    <MonacoEditor
      className="absolute h-full"
      language={language}
      options={
        selectedRequestId != null
          ? { ...RESPONSE_EDITOR_OPTIONS, model: responseModel }
          : RESPONSE_EDITOR_OPTIONS
      }
      onMount={setResponseEditor}
    />
  );
};

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
import { editor } from 'monaco-editor';

export const DefaultRenderer: ResponseRenderer = ({ response, maxBytes }) => {
  const { setResponseEditor } = useResponseEditor();
  const language = useMemo(() => mimeTypeToLanguage(getMimeType(response)!), [response]);
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);

  useResponseData(
    response,
    'utf-8',
    (content) => {
      if (selectedRequestId != null) getResponseModel(selectedRequestId).setValue(content);
    },
    maxBytes
  );

  // Keep the model's language in sync with the response content type.
  useEffect(() => {
    if (selectedRequestId == null) return;
    editor.setModelLanguage(getResponseModel(selectedRequestId), language ?? 'plaintext');
  }, [language, selectedRequestId]);

  return (
    <MonacoEditor
      className="absolute h-full"
      language={language}
      options={RESPONSE_EDITOR_OPTIONS}
      model={selectedRequestId != null ? getResponseModel(selectedRequestId) : undefined}
      onMount={setResponseEditor}
    />
  );
};

import { useCallback, useEffect, useMemo } from 'react';
import {
  useResponseData,
  useResponseEditor,
  ResponseRenderer,
  getMimeType,
} from './PrettyRenderer';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { RESPONSE_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { RESPONSE_MODEL } from '@/lib/monaco/models';
import { mimeTypeToLanguage } from '@/lib/monaco/language';

export const TextualPrettyRenderer: ResponseRenderer = ({ response, skip }) => {
  const { editor, setEditorLanguage, formatResponseEditorText, setResponseEditor } =
    useResponseEditor();
  const language = useMemo(() => mimeTypeToLanguage(getMimeType(response)), [response]);

  const onChange = useCallback(
    (content: string) => {
      RESPONSE_MODEL.setValue(content);
      formatResponseEditorText();
    },
    [formatResponseEditorText]
  );

  useResponseData(response, 'utf-8', onChange, skip);

  useEffect(() => {
    if (editor) {
      setEditorLanguage(RESPONSE_MODEL.getLanguageId());
      const disposable = RESPONSE_MODEL.onDidChangeLanguage((e) =>
        setEditorLanguage(e.newLanguage)
      );
      return () => disposable.dispose();
    }
  }, [language]);

  return (
    <MonacoEditor
      className="absolute h-full"
      language={language}
      options={RESPONSE_EDITOR_OPTIONS}
      onMount={setResponseEditor}
    />
  );
};

import { useEffect, useMemo, useState } from 'react';
import { TextBodyRenderer } from './body-renderer';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { useBodyData } from '@/hooks/useBodyData';
import { RESPONSE_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { mimeTypeToLanguage } from '@/lib/monaco/language';
import { formatReadOnlyEditor } from '@/lib/monaco/format';
import { editor } from 'monaco-editor';

/** Shows a textual body read-only, either as it is or formatted. */
export const TextRenderer: TextBodyRenderer = ({ body, mimeType, model, maxBytes, format }) => {
  const [instance, setInstance] = useState<editor.ICodeEditor>();
  const [content, setContent] = useState<string>();
  const language = useMemo(
    () => (mimeType != null ? mimeTypeToLanguage(mimeType) : undefined),
    [mimeType]
  );

  useBodyData(body?.id, 'utf-8', setContent, maxBytes);

  // Keep the model's language in sync with the content type.
  useEffect(() => {
    editor.setModelLanguage(model, language ?? 'plaintext');
  }, [language, model]);

  // The body may be loaded before or after the editor is mounted, and switching between raw and
  // formatted output must not load it again, so the content is (re)applied here.
  useEffect(() => {
    if (content == null) return;
    model.setValue(content);
    if (format && instance != null) void formatReadOnlyEditor(instance);
  }, [content, format, instance, model]);

  return (
    <MonacoEditor
      className="absolute h-full"
      language={language}
      options={RESPONSE_EDITOR_OPTIONS}
      model={model}
      onMount={setInstance}
    />
  );
};

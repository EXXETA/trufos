import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Language } from '@/lib/monaco/language';
import { cn } from '@/lib/utils';
import { useCollectionStore } from '@/state/collectionStore';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { useEffect } from 'react';
import { getBodyModel } from '@/lib/monaco/models';
import { editor } from 'monaco-editor';
import { OnMount } from '@monaco-editor/react';

interface BodyTabTextInputProps {
  language?: Language;
  className?: string;
  onMount?: OnMount;
}

export default function BodyTabTextInput({ language, className, onMount }: BodyTabTextInputProps) {
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);

  // Keep the model's language in sync with the language prop.
  useEffect(() => {
    if (selectedRequestId == null) return;
    editor.setModelLanguage(getBodyModel(selectedRequestId), language ?? Language.TEXT);
  }, [language, selectedRequestId]);

  if (selectedRequestId == null) return null;

  return (
    <MonacoEditor
      height="100%"
      className={cn('absolute h-full', className)}
      options={REQUEST_EDITOR_OPTIONS}
      language={language}
      model={getBodyModel(selectedRequestId)}
      onMount={onMount}
    />
  );
}

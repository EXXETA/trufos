import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Language } from '@/lib/monaco/language';
import { cn } from '@/lib/utils';
import { useCollectionActions } from '@/state/collectionStore';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { useEffect } from 'react';
import { REQUEST_MODEL } from '@/lib/monaco/models';

interface BodyTabTextInputProps {
  language: Language;
  className?: string;
}

export default function BodyTabTextInput({ language, className }: BodyTabTextInputProps) {
  const { setRequestEditor, setDraftFlag } = useCollectionActions();

  // using this instead of onChange() event to avoid receiving the whole editor content
  useEffect(
    () =>
      REQUEST_MODEL.onDidChangeContent((e) => {
        if (e.isFlush) return; // ignore initial load events
        setDraftFlag();
      }).dispose,
    []
  );

  return (
    <MonacoEditor
      height="100%"
      className={cn('absolute h-full', className)}
      options={REQUEST_EDITOR_OPTIONS}
      language={language}
      onMount={setRequestEditor}
    />
  );
}

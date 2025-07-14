import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Language } from '@/lib/monaco/language';
import { cn } from '@/lib/utils';
import { useCollectionActions } from '@/state/collectionStore';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { useCallback } from 'react';
import { editor } from 'monaco-editor';

interface BodyTabTextInputProps {
  language: Language;
  className?: string;
}

export default function BodyTabTextInput({ language, className }: BodyTabTextInputProps) {
  const { setRequestEditor, setDraftFlag } = useCollectionActions();

  const onChange = useCallback((value: string | undefined, e: editor.IModelContentChangedEvent) => {
    if (e.isFlush) return; // ignore initial load events
    setDraftFlag();
  }, []);

  return (
    <MonacoEditor
      height="100%"
      className={cn('absolute h-full', className)}
      options={REQUEST_EDITOR_OPTIONS}
      language={language}
      onMount={setRequestEditor}
      onChange={onChange}
    />
  );
}

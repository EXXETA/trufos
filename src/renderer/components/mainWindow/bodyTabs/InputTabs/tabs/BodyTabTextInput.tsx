import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Language } from '@/lib/monaco/language';
import { cn } from '@/lib/utils';
import { useCollectionActions } from '@/state/collectionStore';
import { editor } from 'monaco-editor';
import { useCallback } from 'react';
import MonacoEditor from '@/lib/monaco/MonacoEditor';

interface BodyTabTextInputProps {
  language: Language;
  className?: string;
}

export default function BodyTabTextInput({ language, className }: BodyTabTextInputProps) {
  const { setRequestEditor, setDraftFlag } = useCollectionActions();

  const onEditorMount = useCallback(
    (editor: editor.ICodeEditor) => {
      setRequestEditor(editor);
      editor.onDidChangeModelContent((e) => {
        if (e.isFlush) return;
        setDraftFlag();
      });
    },
    [setRequestEditor, setDraftFlag]
  );

  return (
    <MonacoEditor
      height="100%"
      className={cn('absolute h-full', className)}
      options={REQUEST_EDITOR_OPTIONS}
      language={language}
      onMount={(editor) => {
        onEditorMount(editor);
      }}
    />
  );
}

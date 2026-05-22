import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Language } from '@/lib/monaco/language';
import { cn } from '@/lib/utils';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { useEffect, useRef } from 'react';
import { getBodyModel } from '@/lib/monaco/models';
import { editor } from 'monaco-editor';

interface BodyTabTextInputProps {
  language: Language;
  className?: string;
}

export default function BodyTabTextInput({ language, className }: BodyTabTextInputProps) {
  const { setRequestEditor, setDraftFlag } = useCollectionActions();
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const editorRef = useRef<editor.ICodeEditor | undefined>(undefined);

  // Listen for content changes on the current request's body model and mark draft.
  useEffect(() => {
    if (selectedRequestId == null) return;
    const model = getBodyModel(selectedRequestId);
    const disposable = model.onDidChangeContent((e) => {
      if (e.isFlush) return;
      setDraftFlag();
    });
    return () => disposable.dispose();
  }, [selectedRequestId]);

  // Re-attach the correct model whenever the selected request changes.
  useEffect(() => {
    if (editorRef.current != null && selectedRequestId != null) {
      editorRef.current.setModel(getBodyModel(selectedRequestId));
    }
  }, [selectedRequestId]);

  // Keep the model's language in sync with the language prop.
  useEffect(() => {
    if (selectedRequestId == null) return;
    editor.setModelLanguage(getBodyModel(selectedRequestId), language ?? 'plaintext');
  }, [language, selectedRequestId]);

  if (selectedRequestId == null) return null;

  return (
    <MonacoEditor
      height="100%"
      className={cn('absolute h-full', className)}
      options={REQUEST_EDITOR_OPTIONS}
      language={language}
      onMount={(editorInstance) => {
        editorRef.current = editorInstance;
        editorInstance.setModel(getBodyModel(selectedRequestId));
        setRequestEditor(editorInstance);
      }}
    />
  );
}

import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Language } from '@/lib/monaco/language';
import { cn } from '@/lib/utils';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { useEffect } from 'react';
import { getBodyModel } from '@/lib/monaco/models';

interface BodyTabTextInputProps {
  language: Language;
  className?: string;
}

export default function BodyTabTextInput({ language, className }: BodyTabTextInputProps) {
  const { setRequestEditor, setDraftFlag } = useCollectionActions();
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);

  // Listen for content changes on the current request's body model and mark draft.
  useEffect(() => {
    if (selectedRequestId == null) return;
    const model = getBodyModel(selectedRequestId);
    const disposable = model.onDidChangeContent((e) => {
      if (e.isFlush) return; // ignore setValue() flush events
      setDraftFlag();
    });
    return () => disposable.dispose();
  }, [selectedRequestId]);

  if (selectedRequestId == null) return null;

  return (
    <MonacoEditor
      height="100%"
      className={cn('absolute h-full', className)}
      options={{ ...REQUEST_EDITOR_OPTIONS, model: getBodyModel(selectedRequestId) }}
      language={language}
      onMount={setRequestEditor}
    />
  );
}

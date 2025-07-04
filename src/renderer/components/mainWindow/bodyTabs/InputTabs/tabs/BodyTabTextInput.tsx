import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Language } from '@/lib/monaco/language';
import { cn } from '@/lib/utils';
import { useCollectionActions } from '@/state/collectionStore';
import { editor } from 'monaco-editor';
import { useCallback } from 'react';
import MonacoEditor from '@/lib/monaco/MonacoEditor';

import { RequestBodyType } from 'shim/objects/request';
import { useCollectionStore, selectRequest } from '@/state/collectionStore';
interface BodyTabTextInputProps {
  language: Language;
  className?: string;
}

export default function BodyTabTextInput({ language, className }: BodyTabTextInputProps) {
  const { setRequestEditor, setDraftFlag, setRequestBody } = useCollectionActions();
  const request = useCollectionStore(selectRequest);
  const initialBody = request?.body?.type === RequestBodyType.TEXT ? request.body.text : '';

  const onEditorMount = useCallback(
    (editor: editor.ICodeEditor) => {
      setRequestEditor(editor);
      editor.onDidChangeModelContent((e) => {
        if (e.isFlush) return;
        const value = editor.getValue();

        setRequestBody({
          type: RequestBodyType.TEXT,
          mimeType: 'application/json',
          text: value,
        });

        setDraftFlag();
      });
    },
    [setRequestEditor, setDraftFlag, setRequestBody]
  );

  return (
    <MonacoEditor
      height="100%"
      className={cn('absolute h-full', className)}
      options={REQUEST_EDITOR_OPTIONS}
      language={language}
      value={initialBody}
      onMount={(editor) => {
        onEditorMount(editor);
      }}
    />
  );
}

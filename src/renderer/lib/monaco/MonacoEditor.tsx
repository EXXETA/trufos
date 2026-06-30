import { Editor, EditorProps, OnMount } from '@monaco-editor/react';
import { useTheme, TrufosTheme } from '@/contexts/ThemeContext';
import { editor } from 'monaco-editor';
import { useEffect, useRef } from 'react';

interface MonacoEditorProps extends EditorProps {
  /**
   * When provided, the editor will call setModel() with this model on mount
   * and whenever the model instance changes.
   */
  model?: editor.ITextModel;
}

export default function MonacoEditor({ model, onMount, ...props }: MonacoEditorProps) {
  const { theme } = useTheme();
  const editorRef = useRef<editor.ICodeEditor | undefined>(undefined);

  // Re-attach model whenever it changes (e.g. selected request switches).
  useEffect(() => {
    if (editorRef.current != null && model != null) {
      editorRef.current.setModel(model);
    }
  }, [model]);

  const handleMount: OnMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance;
    if (model != null) editorInstance.setModel(model);
    onMount?.(editorInstance, monaco);
  };

  return (
    <Editor
      theme={theme === TrufosTheme.Dark ? 'vs-dark' : 'vs-light'}
      keepCurrentModel
      {...props}
      onMount={handleMount}
    />
  );
}

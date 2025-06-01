import { Editor, EditorProps } from '@monaco-editor/react';

export default function MonacoEditor(props: EditorProps) {
  return (
    <Editor
      theme="vs-dark" // TODO: apply theme from settings in the future
      {...props}
    />
  );
}

import { Editor, EditorProps } from '@monaco-editor/react';
import { useEffect } from 'react';

const noop = () => {};

export default function MonacoEditor(props: EditorProps & { onWillUnmount?: () => void }) {
  const onWillUnmount = props.onWillUnmount ?? noop;

  useEffect(() => {
    return onWillUnmount;
  }, [onWillUnmount]);

  return (
    <Editor
      theme="vs-dark" // TODO: apply theme from settings in the future
      {...props}
    />
  );
}

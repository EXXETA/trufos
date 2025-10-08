import { Editor, EditorProps } from '@monaco-editor/react';
import { useTheme } from '@/contexts/ThemeContext';

export default function MonacoEditor(props: EditorProps) {
  const { theme } = useTheme();

  return <Editor theme={theme === 'light' ? 'vs-light' : 'vs-dark'} keepCurrentModel {...props} />;
}

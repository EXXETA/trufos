import { Editor, EditorProps } from '@monaco-editor/react';
import { useTheme } from '@/contexts/ThemeContext';

export default function MonacoEditor(props: EditorProps) {
  const { theme } = useTheme();

  return <Editor theme={theme === 'dark' ? 'vs-dark' : 'vs-light'} keepCurrentModel {...props} />;
}

import { editor } from 'monaco-editor';
import IEditorOptions = editor.IEditorOptions;

export const DEFAULT_MONACO_OPTIONS: Partial<IEditorOptions> = {
  minimap: { enabled: false },
  wordWrap: 'on',
};

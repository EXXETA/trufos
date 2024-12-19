import { editor } from 'monaco-editor';

export const DEFAULT_MONACO_OPTIONS: Partial<editor.IStandaloneEditorConstructionOptions> = {
  minimap: { enabled: false },
  wordWrap: 'on',
  'semanticHighlighting.enabled': true,
};

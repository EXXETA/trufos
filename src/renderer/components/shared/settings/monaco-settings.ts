import { editor } from 'monaco-editor';

export const DEFAULT_MONACO_OPTIONS: Partial<editor.IStandaloneEditorConstructionOptions> = {
  minimap: { enabled: false },
  wordWrap: 'on',
  'semanticHighlighting.enabled': true,
};

/**
 * Maximum length of a template variable string including the brackets and spaces between.
 */
export const MAX_TEMPLATE_VARIABLE_LENGTH = 100;

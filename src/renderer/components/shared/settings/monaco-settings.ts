import { editor } from 'monaco-editor';

export const DEFAULT_MONACO_OPTIONS: Partial<editor.IStandaloneEditorConstructionOptions> = {
  minimap: { enabled: false },
  wordWrap: 'on',
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
    alwaysConsumeMouseWheel: true,
    useShadows: false,
  },
  smoothScrolling: true,
  mouseWheelScrollSensitivity: 1,
};

export const REQUEST_EDITOR_OPTIONS: Partial<editor.IStandaloneEditorConstructionOptions> = {
  ...DEFAULT_MONACO_OPTIONS,
  'semanticHighlighting.enabled': true, // needed for template variable syntax highlighting
};

export const RESPONSE_EDITOR_OPTIONS: Partial<editor.IStandaloneEditorConstructionOptions> = {
  ...DEFAULT_MONACO_OPTIONS,
  readOnly: true,
};

/**
 * Maximum length of a template variable string including the brackets and spaces between.
 */
export const MAX_TEMPLATE_VARIABLE_LENGTH = 100;

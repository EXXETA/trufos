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
  fixedOverflowWidgets: true,
};

export const REQUEST_EDITOR_OPTIONS: Partial<editor.IStandaloneEditorConstructionOptions> = {
  ...DEFAULT_MONACO_OPTIONS,
  'semanticHighlighting.enabled': true, // needed for template variable syntax highlighting
};

export const RESPONSE_EDITOR_OPTIONS: Partial<editor.IStandaloneEditorConstructionOptions> = {
  ...DEFAULT_MONACO_OPTIONS,
  readOnly: true,
};

export const SCRIPT_EDITOR_OPTIONS: Partial<editor.IStandaloneEditorConstructionOptions> = {
  ...DEFAULT_MONACO_OPTIONS,
};

/**
 * Height of a single line editor in pixels. Must match the line height of
 * {@link SINGLE_LINE_EDITOR_OPTIONS}.
 */
export const SINGLE_LINE_EDITOR_HEIGHT = 20;

/**
 * Options for editors that hold a single line of text and therefore hide everything that only
 * makes sense in a multi-line editor.
 */
export const SINGLE_LINE_EDITOR_OPTIONS: Partial<editor.IStandaloneEditorConstructionOptions> = {
  ...DEFAULT_MONACO_OPTIONS,
  fontSize: 14, // same as the text-sm of a regular input
  lineHeight: SINGLE_LINE_EDITOR_HEIGHT,
  lineNumbers: 'off',
  lineDecorationsWidth: 0,
  glyphMargin: false,
  folding: false,
  overviewRulerLanes: 0,
  renderLineHighlight: 'none',
  occurrencesHighlight: 'off',
  links: false,
  wordWrap: 'off',
  scrollBeyondLastLine: false,
  scrollBeyondLastColumn: 0,
  scrollbar: { vertical: 'hidden', horizontal: 'hidden', handleMouseWheel: false },
  padding: { top: 0, bottom: 0 },
  find: { addExtraSpaceOnTop: false, seedSearchStringFromSelection: 'never' },
  automaticLayout: true,
};

/**
 * Maximum length of a template variable string including the brackets and spaces between.
 */
export const MAX_TEMPLATE_VARIABLE_LENGTH = 100;

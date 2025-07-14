import * as monaco from 'monaco-editor';

export const REQUEST_MODEL = monaco.editor.createModel(
  '',
  undefined,
  monaco.Uri.parse('inmemory://request-editor')
);

export const RESPONSE_MODEL = monaco.editor.createModel(
  '',
  undefined,
  monaco.Uri.parse('inmemory://response-editor')
);

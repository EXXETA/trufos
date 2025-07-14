import { editor, Uri } from 'monaco-editor';

export const REQUEST_MODEL = editor.createModel(
  '',
  undefined,
  Uri.parse('inmemory://request-editor')
);

export const RESPONSE_MODEL = editor.createModel(
  '',
  undefined,
  Uri.parse('inmemory://response-editor')
);

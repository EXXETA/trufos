import { languages } from 'monaco-editor';

// plaintext
languages.setMonarchTokensProvider('plaintext', {
  tokenizer: {
    root: [[/\{\{\s*(\$?\w+)\s*}}/, 'variable.other']],
  },
});

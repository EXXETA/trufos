import { languages } from 'monaco-editor';
import { TemplateVariableSemanticTokensProvider } from '@/lib/monaco/TemplateVariableSemanticTokensProvider';

// plaintext using fast syntax highlighting
languages.setMonarchTokensProvider('plaintext', {
  tokenizer: {
    root: [[/\{\{\s*(\$?\w+)\s*}}/, 'variable.template']],
  },
});

// other rich languages using semantic tokens
languages.registerDocumentSemanticTokensProvider(
  ['json', 'xml'],
  new TemplateVariableSemanticTokensProvider()
);

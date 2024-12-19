import { languages } from 'monaco-editor';
import { TemplateVariableSemanticTokensProvider } from '@/lib/monaco/TemplateVariableSemanticTokensProvider';
import { TemplateVariableCompletionItemsProvider } from '@/lib/monaco/TemplateVariableCompletionItemsProvider';

export enum Language {
  JSON = 'json',
  XML = 'xml',
  TEXT = 'plaintext',
}

const supportedLanguages = [Language.JSON, Language.XML, Language.TEXT];

// plaintext using fast syntax highlighting
languages.setMonarchTokensProvider(Language.TEXT, {
  tokenizer: {
    root: [[/\{\{\s*(\$?\w+)\s*}}/, 'variable.template']],
  },
});

// other rich languages using semantic tokens
languages.registerDocumentSemanticTokensProvider(
  supportedLanguages.filter((lang) => lang !== Language.TEXT),
  new TemplateVariableSemanticTokensProvider()
);

// completion items provider (suggests template variables)
languages.registerCompletionItemProvider(
  supportedLanguages,
  new TemplateVariableCompletionItemsProvider()
);

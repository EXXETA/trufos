import { languages } from 'monaco-editor';
import { TemplateVariableSemanticTokensProvider } from './template-variable-semantic-tokens-provider';
import { TemplateVariableCompletionItemsProvider } from './template-variable-completion-items-provider';
import { TemplateVariableHoverProvider } from './template-variable-hover-provider';

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

// hover provider (shows template variable value on hover)
languages.registerHoverProvider(supportedLanguages, new TemplateVariableHoverProvider());

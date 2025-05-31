import { languages } from 'monaco-editor';
import { TemplateVariableCompletionItemsProvider } from './template-variable-completion-items-provider';
import { TemplateVariableHoverProvider } from './template-variable-hover-provider';
import { TemplateVariableSemanticTokensProvider } from './template-variable-semantic-tokens-provider';

export enum Language {
  JSON = 'json',
  XML = 'xml',
  TEXT = 'plaintext',
}

const supportedLanguages = [Language.JSON, Language.XML, Language.TEXT];
const formattableLanguages = [Language.JSON, Language.XML];

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

/**
 * Determines whether the specified language supports code formatting.
 *
 * @param {string | Language} [language] - The language to check, either as a string or a `Language` enum value.
 * @returns {boolean} - Returns `true` if the language supports formatting; otherwise, `false`.
 */
export const isFormattableLanguage = (language?: string | Language): boolean => {
  return formattableLanguages.includes(language as Language);
};

import { languages } from 'monaco-editor';
import xmlFormat from 'xml-formatter';
import { TemplateVariableCompletionItemsProvider } from './template-variable-completion-items-provider';
import { TemplateVariableHoverProvider } from './template-variable-hover-provider';
import { TemplateVariableSemanticTokensProvider } from './template-variable-semantic-tokens-provider';

export enum Language {
  JSON = 'json',
  XML = 'xml',
  TEXT = 'plaintext',
}

const LANGUAGE_TO_MIME_TYPE_MAP: Record<Language, string> = {
  [Language.JSON]: 'application/json',
  [Language.XML]: 'application/xml',
  [Language.TEXT]: 'text/plain',
};

const MIME_TYPE_TO_LANGUAGE_MAP: Record<string, Language> = Object.fromEntries(
  Object.entries(LANGUAGE_TO_MIME_TYPE_MAP).map(([lang, mimeType]) => [mimeType, lang as Language])
);

/**
 * Converts a language enum value to its corresponding MIME type.
 *
 * @param language The language enum value to convert.
 * @return The corresponding MIME type as a string.
 */
export function languageToMimeType(language: Language): string {
  return LANGUAGE_TO_MIME_TYPE_MAP[language];
}

/**
 * Converts a MIME type string to its corresponding language enum value.
 *
 * @param mimeType The MIME type string to convert.
 * @return The corresponding language enum value, or undefined if not found.
 */
export function mimeTypeToLanguage(mimeType: string): Language {
  return MIME_TYPE_TO_LANGUAGE_MAP[mimeType];
}

const supportedLanguages = [Language.JSON, Language.XML, Language.TEXT];
const formattableLanguages = new Set([Language.JSON, Language.XML]);

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

// XML formatting provider
languages.registerDocumentFormattingEditProvider(Language.XML, {
  provideDocumentFormattingEdits: (model) => {
    const text = model.getValue();
    const formattedText = xmlFormat(text);
    return [
      {
        range: model.getFullModelRange(),
        text: formattedText,
      },
    ];
  },
});

/**
 * Determines whether the specified language supports code formatting.
 *
 * @param language The language to check, as a string or enum value.
 * @returns `true` if the language supports formatting; otherwise, `false`.
 */
export const isFormattableLanguage = (language?: string | Language): boolean => {
  return formattableLanguages.has(language as Language);
};

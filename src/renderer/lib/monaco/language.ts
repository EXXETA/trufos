import { languages, typescript } from 'monaco-editor';
import xmlFormat from 'xml-formatter';
import { TemplateVariableCompletionItemsProvider } from './template-variable-completion-items-provider';
import { TemplateVariableHoverProvider } from './template-variable-hover-provider';
import { TemplateVariableSemanticTokensProvider } from './template-variable-semantic-tokens-provider';
import trufosDeclaration from '@/assets/trufos-scripting-api.d.ts?raw';

typescript.javascriptDefaults.addExtraLib(trufosDeclaration);

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

// Common spellings that resolve to the same language as a canonical type.
const ALIAS_MIME_TYPE_TO_LANGUAGE_MAP: Record<string, Language> = {
  'text/xml': Language.XML,
  'text/json': Language.JSON,
};

/**
 * Normalizes a MIME type so variants of the same media type map to the same language:
 * parameters (`application/json; charset=utf-8`) are dropped, casing is ignored, and the
 * structured syntax suffix (RFC 6839) is treated like the base type it extends
 * (`application/problem+json` behaves as `application/json`).
 *
 * @param mimeType The MIME type string to normalize.
 * @return The normalized MIME type, without parameters and lowercased.
 */
function normalizeMimeType(mimeType: string): string {
  // Drop parameters such as "; charset=utf-8" before any other processing.
  const withoutParameters = mimeType.split(';', 1)[0].trim().toLowerCase();
  // Map RFC 6839 structured syntax suffixes onto the base type they extend:
  // "application/problem+json" -> "application/json", "application/soap+xml" -> "application/xml".
  const suffixSeparator = withoutParameters.lastIndexOf('+');
  if (suffixSeparator !== -1) {
    const type = withoutParameters.slice(0, suffixSeparator);
    const suffix = withoutParameters.slice(suffixSeparator + 1);
    const baseType = type.slice(0, type.indexOf('/') + 1);
    return `${baseType}${suffix}`;
  }
  return withoutParameters;
}

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
 * The match tolerates parameters, casing and structured syntax suffixes, and treats the
 * common `text/xml` and `text/json` spellings as XML and JSON. Unknown types map to `undefined`,
 * which the caller treats as plain text.
 *
 * @param mimeType The MIME type string to convert.
 * @return The corresponding language enum value, or undefined if not found.
 */
export function mimeTypeToLanguage(mimeType: string): Language | undefined {
  if (typeof mimeType !== 'string' || mimeType.trim() === '') {
    return undefined;
  }
  const normalized = normalizeMimeType(mimeType);
  return MIME_TYPE_TO_LANGUAGE_MAP[normalized] ?? ALIAS_MIME_TYPE_TO_LANGUAGE_MAP[normalized];
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

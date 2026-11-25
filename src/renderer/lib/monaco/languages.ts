/**
 * Language identifiers and the pure helpers that map between a language and a
 * MIME type. This module has no import side effects, so it can be imported by
 * tests and components without pulling in Monaco. The providers that register
 * languages with the editor live in `./language`, which re-exports everything
 * below.
 */

export enum Language {
  JSON = 'json',
  XML = 'xml',
  TEXT = 'plaintext',
}

const LANGUAGE_TO_MIME_TYPE = new Map<Language, string>([
  [Language.JSON, 'application/json'],
  [Language.XML, 'application/xml'],
  [Language.TEXT, 'text/plain'],
]);

// A single literal map is easier to read than an inverted map plus aliases, and a
// `Map` avoids the inherited-property trap a plain object has: with an object,
// `mimeTypeToLanguage('constructor')` would return `Object`.
const MIME_TYPE_TO_LANGUAGE = new Map<string, Language>([
  ['application/json', Language.JSON],
  ['text/json', Language.JSON],
  ['application/xml', Language.XML],
  ['text/xml', Language.XML],
  ['text/plain', Language.TEXT],
]);

// Subtypes with a structured syntax suffix (RFC 6839), e.g. `application/problem+json`.
// The suffix maps straight to a language rather than being rewritten into a base
// MIME type, which would only work when the result happens to be a known type.
const STRUCTURED_SUFFIXES: [RegExp, Language][] = [
  [/^[^\s/]+\/[^\s/]+\+json$/, Language.JSON],
  [/^[^\s/]+\/[^\s/]+\+xml$/, Language.XML],
];

/**
 * The media type without its parameters, lowercased, e.g.
 * `"application/json; charset=utf-8"` becomes `"application/json"`.
 *
 * @param mimeType The MIME type string to reduce.
 * @return The lowercased media type, without parameters.
 */
export function mimeTypeEssence(mimeType: string): string {
  return mimeType.split(';', 1)[0].trim().toLowerCase();
}

/**
 * Converts a language value to its canonical MIME type.
 *
 * @param language The language to convert.
 * @return The corresponding MIME type.
 */
export function languageToMimeType(language: Language): string {
  return LANGUAGE_TO_MIME_TYPE.get(language) ?? 'text/plain';
}

/**
 * Converts a MIME type to its language. Parameters and casing are ignored, the
 * common `text/json` and `text/xml` spellings are recognised, and a subtype with
 * a structured syntax suffix (RFC 6839) maps to the language of that suffix —
 * so `application/problem+json` is JSON and `application/soap+xml` is XML.
 *
 * @param mimeType The MIME type string to convert.
 * @return The corresponding language, or `undefined` when it is not one the editor highlights.
 */
export function mimeTypeToLanguage(mimeType: string): Language | undefined {
  const essence = mimeTypeEssence(mimeType);
  const direct = MIME_TYPE_TO_LANGUAGE.get(essence);
  if (direct !== undefined) {
    return direct;
  }
  for (const [pattern, language] of STRUCTURED_SUFFIXES) {
    if (pattern.test(essence)) {
      return language;
    }
  }
  return undefined;
}

const formattableLanguages = new Set([Language.JSON, Language.XML]);

/**
 * Determines whether the specified language supports code formatting.
 *
 * @param language The language to check, as a string or enum value.
 * @returns `true` if the language supports formatting; otherwise, `false`.
 */
export const isFormattableLanguage = (language?: string | Language): boolean => {
  return formattableLanguages.has(language as Language);
};

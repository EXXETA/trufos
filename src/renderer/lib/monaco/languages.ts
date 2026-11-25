/**
 * Language identifiers and the pure helpers that map between a language and a
 * MIME type. This module has no import side effects, so it can be imported by
 * tests and components without pulling in Monaco. The providers that register
 * languages with the editor live in `./register-languages`.
 */

import { mimeTypeEssence } from '@/lib/body';

export enum Language {
  JSON = 'json',
  XML = 'xml',
  TEXT = 'plaintext',
}

// A Record keeps the compiler honest: every language needs a MIME type here.
const LANGUAGE_TO_MIME_TYPE: Record<Language, string> = {
  [Language.JSON]: 'application/json',
  [Language.XML]: 'application/xml',
  [Language.TEXT]: 'text/plain',
};

// A `Map` avoids the inherited-property trap a plain object has: with an object,
// `mimeTypeToLanguage('constructor')` would return `Object`, and the content
// type comes from the server.
const MIME_TYPE_TO_LANGUAGE = new Map<string, Language>([
  ['application/json', Language.JSON],
  ['text/json', Language.JSON],
  ['application/xml', Language.XML],
  ['text/xml', Language.XML],
  ['text/plain', Language.TEXT],
]);

/** The structured syntax suffix (RFC 6839) turned into a language, e.g. `json` in `application/problem+json`. */
const SUFFIX_TO_LANGUAGE = new Map<string, Language>([
  ['json', Language.JSON],
  ['xml', Language.XML],
]);

/** Captures the structured syntax suffix (RFC 6839), e.g. `json` in `application/problem+json`. */
const STRUCTURED_SUFFIX = /^[^\s/]+\/[^\s/]+\+([^\s/+]+)$/;

/**
 * Converts a language value to its canonical MIME type.
 *
 * @param language The language to convert.
 * @return The corresponding MIME type.
 */
export function languageToMimeType(language: Language): string {
  return LANGUAGE_TO_MIME_TYPE[language];
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
  const suffix = STRUCTURED_SUFFIX.exec(essence)?.[1];
  return (
    MIME_TYPE_TO_LANGUAGE.get(essence) ??
    (suffix != null ? SUFFIX_TO_LANGUAGE.get(suffix) : undefined)
  );
}

/**
 * Determines whether the specified language supports code formatting.
 *
 * @param language The language to check, as an enum value or `undefined`.
 * @returns `true` if the language supports formatting; otherwise, `false`.
 */
export const isFormattableLanguage = (language: Language | undefined): boolean =>
  language === Language.JSON || language === Language.XML;

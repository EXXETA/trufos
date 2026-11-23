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

const MIME_TYPE_TO_LANGUAGE_MAP: Record<string, Language> = {
  ...Object.fromEntries(
    Object.entries(LANGUAGE_TO_MIME_TYPE_MAP).map(([lang, mimeType]) => [
      mimeType,
      lang as Language,
    ])
  ),
  'text/json': Language.JSON,
  'text/xml': Language.XML,
};

const STRUCTURED_SUFFIX_TO_LANGUAGE: readonly [string, Language][] = [
  ['+json', Language.JSON],
  ['+xml', Language.XML],
];

const formattableLanguages = new Set([Language.JSON, Language.XML]);

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
export function mimeTypeToLanguage(mimeType: string): Language | undefined {
  const normalized = mimeType.split(';', 1)[0].trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (Object.hasOwn(MIME_TYPE_TO_LANGUAGE_MAP, normalized)) {
    return MIME_TYPE_TO_LANGUAGE_MAP[normalized];
  }

  const slashIndex = normalized.indexOf('/');
  if (slashIndex <= 0) {
    return undefined;
  }
  const subtype = normalized.slice(slashIndex + 1);
  if (!subtype || /\s/.test(normalized)) {
    return undefined;
  }

  for (const [suffix, language] of STRUCTURED_SUFFIX_TO_LANGUAGE) {
    if (subtype.length > suffix.length && subtype.endsWith(suffix)) {
      return language;
    }
  }

  return undefined;
}

/**
 * Determines whether the specified language supports code formatting.
 *
 * @param language The language to check, as a string or enum value.
 * @returns `true` if the language supports formatting; otherwise, `false`.
 */
export const isFormattableLanguage = (language?: string | Language): boolean => {
  return formattableLanguages.has(language as Language);
};

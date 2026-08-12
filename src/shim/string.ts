/**
 * The maximum length of a file or directory name derived from a title. Common file systems (APFS,
 * ext4, NTFS) reject names longer than 255 bytes, which titles can easily exceed, e.g. when an
 * imported OpenAPI operation summary contains the whole endpoint documentation. The limit is kept
 * well below that so that paths stay readable and leave room for suffixes such as `-2`.
 */
export const MAX_TITLE_DIR_NAME_LENGTH = 64;

/**
 * Sanitize a title by replacing invalid characters and formatting it. The resulting string may be
 * used as file or directory name. Camel case titles are split into words, so that machine-readable
 * titles such as OpenAPI operation IDs become readable names as well.
 * @param title the title to sanitize
 * @returns the sanitized, dash separated title, at most {@link MAX_TITLE_DIR_NAME_LENGTH}
 *  characters long. May be empty if the title has no valid characters at all.
 */
export function sanitizeTitle(title: string): string {
  const name = splitCamelCase(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return truncate(name, MAX_TITLE_DIR_NAME_LENGTH, '-');
}

/**
 * Shortens text to at most `maxLength` characters, preferring to cut at the last boundary within
 * the limit so that words stay intact. If that boundary is in the first half of the allowed length,
 * the text is cut hard instead, because cutting there would discard too much of it.
 * @param text the text to shorten
 * @param maxLength the maximum length of the resulting text
 * @param boundary the boundary to cut at, e.g. a space or a dash
 * @returns the shortened text, without trailing boundaries
 */
export function truncate(text: string, maxLength: number, boundary: string) {
  if (text.length <= maxLength) return text;

  const cut = text.slice(0, maxLength);
  const lastBoundary = cut.lastIndexOf(boundary);
  let truncated = lastBoundary >= maxLength / 2 ? cut.slice(0, lastBoundary) : cut;
  while (truncated.endsWith(boundary)) {
    truncated = truncated.slice(0, -boundary.length);
  }
  return truncated;
}

/**
 * Inserts dashes at camel case boundaries, e.g. `getAppVersions` becomes `get-App-Versions` and
 * `getHTTPStatus` becomes `get-HTTP-Status`.
 * @param value the value to split
 * @returns the value with dashes at all camel case boundaries
 */
function splitCamelCase(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2');
}

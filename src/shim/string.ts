/**
 * The maximum length of a file or directory name derived from a title. Common file systems (APFS,
 * ext4, NTFS) reject names longer than 255 bytes, which titles can easily exceed, e.g. when an
 * imported OpenAPI operation summary contains the whole endpoint documentation. The limit is kept
 * well below that so that paths stay readable and leave room for suffixes such as `-2`.
 */
export const MAX_TITLE_DIR_NAME_LENGTH = 64;

/**
 * Fallback for titles that have no characters usable in a file name, e.g. titles written entirely
 * in a non-Latin script. Returning an empty name instead would be a hazard for every caller,
 * because `path.join(dir, '')` is `dir` — a collection would be written into the directory that
 * was meant to be its parent.
 */
export const FALLBACK_TITLE_DIR_NAME = 'untitled';

/**
 * Sanitize a title by replacing invalid characters and formatting it. The resulting string may be
 * used as file or directory name. Camel case titles are split into words, so that machine-readable
 * titles such as OpenAPI operation IDs become readable names as well. Diacritics are stripped
 * rather than replaced, so that e.g. `prüfen` becomes `prufen` instead of `pr-fen`.
 * @param title the title to sanitize
 * @returns the sanitized, dash separated title, at most {@link MAX_TITLE_DIR_NAME_LENGTH}
 *  characters long. Never empty: {@link FALLBACK_TITLE_DIR_NAME} is returned if nothing remains.
 */
export function sanitizeTitle(title: string): string {
  const name = stripDiacritics(splitCamelCase(title))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return truncate(name, MAX_TITLE_DIR_NAME_LENGTH, '-') || FALLBACK_TITLE_DIR_NAME;
}

/**
 * Finds a unique name by appending a counter to the base name until it is not taken anymore,
 * e.g. `pets`, `pets-2`, `pets-3`. Used for directory names, variable names and environment keys.
 * @param baseName the desired name
 * @param isTaken tells whether a candidate name is already taken
 * @returns the first free name
 */
export function uniqueName(baseName: string, isTaken: (name: string) => boolean): string {
  let name = baseName;
  for (let counter = 2; isTaken(name); counter++) name = `${baseName}-${counter}`;
  return name;
}

/**
 * Like {@link uniqueName}, but for an asynchronous taken check, e.g. against the file system.
 */
export async function uniqueNameAsync(
  baseName: string,
  isTaken: (name: string) => Promise<boolean>
): Promise<string> {
  let name = baseName;
  for (let counter = 2; await isTaken(name); counter++) name = `${baseName}-${counter}`;
  return name;
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

/**
 * Removes diacritics while keeping the base letters, e.g. `é` becomes `e` and `ü` becomes `u`.
 * @param value the value to strip
 * @returns the value with all diacritics removed
 */
function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

import { HttpHeaders } from 'shim/objects/headers';

/** Bodies larger than this are only shown partially. The full body can still be downloaded. */
export const BODY_SIZE_LIMIT = 5_000_000; // 5 MB

/**
 * Reduces a MIME type to its essence: the media type without parameters, trimmed and lowercased,
 * e.g. `"application/json; charset=utf-8"` becomes `"application/json"`. Shared by every place
 * that compares MIME types so they normalise the same way.
 *
 * @param mimeType the raw MIME type value
 * @returns the lowercased media type, without parameters
 */
export function mimeTypeEssence(mimeType: string): string {
  return mimeType.split(';', 1)[0].trim().toLowerCase();
}

/**
 * @param headers the headers sent with a body
 * @returns the MIME type of the body without parameters like the charset, or `undefined` if the
 * headers do not declare one
 */
export function getMimeTypeFromHeaders(headers?: HttpHeaders): string | undefined {
  const value = headers?.['content-type'];
  const contentType = Array.isArray(value) ? value[0] : value;
  return contentType === undefined ? undefined : mimeTypeEssence(contentType);
}

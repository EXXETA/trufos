import { HttpHeaders } from 'shim/objects/headers';

/** Bodies larger than this are only shown partially. The full body can still be downloaded. */
export const BODY_SIZE_LIMIT = 5_000_000; // 5 MB

/**
 * @param headers the headers sent with a body
 * @returns the MIME type of the body without parameters like the charset, or `undefined` if the
 * headers do not declare one
 */
export function getMimeTypeFromHeaders(headers?: HttpHeaders): string | undefined {
  const value = headers?.['content-type'];
  const contentType = Array.isArray(value) ? value[0] : value;
  return contentType?.split(';', 1)[0].trim();
}

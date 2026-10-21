import { z } from 'zod';

export const TrufosHeader = z.object({
  key: z.string(),
  value: z.string(),
  isActive: z.boolean(),
});

export type TrufosHeader = z.infer<typeof TrufosHeader>;

const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Check if a header key is a valid HTTP header name (RFC 9110 token).
 * @param key the header key to check
 */
export function isValidHeaderName(key: string): boolean {
  return HEADER_NAME_PATTERN.test(key);
}

/**
 * Check if a header is an empty placeholder row that should not be sent.
 * @param header the header to check
 */
export function isBlankHeader(header: TrufosHeader): boolean {
  return header.key.trim() === '';
}

/**
 * Check if a header is sent: it is active and has a key.
 * @param header the header to check
 */
export function isSentHeader(header: TrufosHeader): boolean {
  return header.isActive && !isBlankHeader(header);
}

/**
 * Returns the key that identifies a header. HTTP header names are case-insensitive, so headers
 * whose keys only differ in case have the same one.
 * @param key the header key
 */
export function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase();
}

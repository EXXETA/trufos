import type { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { z } from 'zod';

/** The most bytes a page of a body may have, as a tool result ends up in the model's context. */
export const MAX_PAGE_BYTES = 64 * 1024;

/** How many bytes of a response body are previewed in the result of `send_request`. */
export const PREVIEW_BYTES = 16 * 1024;

/** The input of the tools that read a body page by page. */
export const PageInput = {
  offset: z
    .int()
    .nonnegative()
    .default(0)
    .describe(
      'The offset of the first byte to read. Continue with `nextOffset` of a previous page.'
    ),
  length: z
    .int()
    .positive()
    .max(MAX_PAGE_BYTES)
    .default(MAX_PAGE_BYTES)
    .describe(`How many bytes to read, at most ${MAX_PAGE_BYTES}.`),
};

/** A page of a body, decoded as UTF-8. */
export interface BodyPage {
  text: string;
  /** The offset of the first byte of the page. */
  offset: number;
  /**
   * The offset to read the next page from, or `null` if the page reaches the end of the body. A page
   * never ends inside a UTF-8 character, so this may be less than `offset + length`.
   */
  nextOffset: number | null;
  /** The size of the whole body in bytes. */
  totalSize: number;
}

/**
 * Reads a page of a body.
 * @param page the bytes of the page: the body from `offset` on, at most as many bytes as the page
 * may have. Ends early at the end of the body.
 * @param offset the offset of the first byte of the page
 * @param totalSize the size of the whole body in bytes
 */
export async function readPage(
  page: Readable,
  offset: number,
  totalSize: number
): Promise<BodyPage> {
  const bytes = await buffer(page);
  const reachesEnd = offset + bytes.length >= totalSize;
  // a character cut off at the end of the body is decoded as it is, it will never be complete
  const complete = reachesEnd ? bytes.length : completeUtf8Length(bytes);
  return {
    text: bytes.subarray(0, complete).toString('utf8'),
    offset,
    nextOffset: reachesEnd ? null : offset + complete,
    totalSize,
  };
}

/**
 * Returns the length of the bytes without a UTF-8 character that is cut off at their end. Bytes
 * that are no valid UTF-8 are kept, so a binary body still advances.
 */
export function completeUtf8Length(bytes: Uint8Array): number {
  // a character has at most 4 bytes, so its lead byte is at most 3 bytes before the end
  for (let i = bytes.length - 1; i >= Math.max(0, bytes.length - 4); i--) {
    const byte = bytes[i];
    if ((byte & 0b1100_0000) === 0b1000_0000) continue; // continuation byte
    const size = byte >= 0b1111_0000 ? 4 : byte >= 0b1110_0000 ? 3 : byte >= 0b1100_0000 ? 2 : 1;
    // the whole page is a single incomplete character: keep it, so reading advances
    if (i + size > bytes.length && i > 0) return i;
    return bytes.length;
  }
  return bytes.length;
}

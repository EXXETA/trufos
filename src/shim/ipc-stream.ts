import { z } from 'zod';
import { TrufosId } from './objects/id';
import { ScriptType } from './scripting';

/**
 * The input for opening a stream. If a string is passed, it is treated as a file path. A
 * `request-body` or `script` input streams the text body or a script of a request of the open
 * collection, from its draft if it has one. A `body` input streams a body stored in the main
 * process by its ID, e.g. one of the request history.
 */
export const StreamInput = z.union([
  z.string().min(1),
  z.object({ type: z.literal('request-body'), requestId: TrufosId }),
  z.object({ type: z.literal('script'), source: z.enum(ScriptType), requestId: TrufosId }),
  z.object({ type: z.literal('body'), id: z.string().min(1) }),
]);
export type StreamInput = z.infer<typeof StreamInput>;

export const StringBufferEncoding = z.enum([
  'ascii',
  'utf8',
  'utf-8',
  'utf16le',
  'utf-16le',
  'ucs2',
  'ucs-2',
  'base64',
  'base64url',
  'latin1',
  'hex',
] as const satisfies Exclude<BufferEncoding, 'binary'>[]);
export type StringBufferEncoding = z.infer<typeof StringBufferEncoding>;

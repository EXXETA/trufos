import { ScriptType } from './scripting';

/**
 * The input for opening a stream. If a string is passed, it is treated as a file path. A
 * `request-body` or `script` input streams the text body or a script of a request of the open
 * collection, from its draft if it has one. A `body` input streams a body stored in the main
 * process by its ID, e.g. one of the request history.
 */
export type StreamInput =
  | string
  | { type: 'request-body'; requestId: string }
  | { type: 'script'; source: ScriptType; requestId: string }
  | { type: 'body'; id: string };

export type StringBufferEncoding = Exclude<BufferEncoding, 'binary'>;

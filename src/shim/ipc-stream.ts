import { TrufosRequest } from 'shim/objects/request';
import { TrufosResponse } from 'shim/objects/response';
import { ScriptType } from './scripting';

/**
 * The input for opening a stream. If a string is passed, it is treated as a file path. A `body`
 * input streams a body stored in the main process by its ID, e.g. one of the request history.
 */
export type StreamInput =
  | string
  | TrufosRequest
  | TrufosResponse
  | { type: 'script'; source: ScriptType; request: TrufosRequest }
  | { type: 'body'; id: string };

export type StringBufferEncoding = Exclude<BufferEncoding, 'binary'>;

import { TrufosRequest } from 'shim/objects/request';
import { TrufosResponse } from 'shim/objects/response';
import { ScriptType } from './scripting';

/**
 * The input for opening a stream. If a string is passed, it is treated as a file path.
 */
export type StreamInput =
  | string
  | TrufosRequest
  | TrufosResponse
  | { type: 'script'; source: ScriptType; request: TrufosRequest };

export type StringBufferEncoding = Exclude<BufferEncoding, 'binary'>;

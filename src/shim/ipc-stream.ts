import { TrufosRequest } from 'shim/objects/request';
import { TrufosResponse } from 'shim/objects/response';

export type StreamInput = string | TrufosRequest | TrufosResponse;

export type StringBufferEncoding = Exclude<BufferEncoding, 'binary'>;

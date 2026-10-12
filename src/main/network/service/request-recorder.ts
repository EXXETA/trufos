import type { ScriptLog, SentRequest } from 'shim/history';
import type { BodyCopy } from './request-body-copy';

/** Receives the output of a user script, e.g. its console calls. */
export type ScriptLogger = (log: ScriptLog) => void;

/** Records what happens while a request is sent, e.g. for the request history. */
export interface RequestRecorder {
  /**
   * Records the request exactly as it is sent.
   * @param request the method, resolved URL and headers of the sent request
   * @param body the copy of the sent body, see `copyRequestBody`. The recorder owns it from now on.
   */
  sent(request: Omit<SentRequest, 'body'>, body?: BodyCopy): void;

  /** Records a console call or error of a user script of the request. */
  scriptLog: ScriptLogger;
}

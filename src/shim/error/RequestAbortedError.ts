/**
 * Rejection reason of a request that was aborted on purpose, e.g. because the user pressed the
 * cancel button. Thrown in the main process instead of the platform's own abort error (a
 * `DOMException` with read-only properties that neither logging nor IPC serialization handle well),
 * and re-thrown in the renderer process for the sends it knows it aborted itself.
 *
 * A cancellation is a user action rather than a failure, so callers are expected to swallow this
 * error instead of reporting it.
 */
export class RequestAbortedError extends Error {
  public static readonly MESSAGE = 'The request was aborted';

  constructor() {
    super(RequestAbortedError.MESSAGE);
    Reflect.setPrototypeOf(this, RequestAbortedError.prototype);
    this.name = RequestAbortedError.name;
  }
}

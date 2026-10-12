import { Transform, TransformCallback, Writable } from 'node:stream';

/**
 * Passes a body stream through unchanged while copying it, so the body that was actually sent can
 * be shown in the request history. Each chunk is only passed on once the copy accepted it, so a
 * slow copy applies backpressure instead of buffering the body in memory.
 */
export class BodyRecorder extends Transform {
  /**
   * @param copy the stream the body is copied to. It is ended with the body, and destroyed if
   * sending the body failed.
   */
  constructor(private readonly copy: Writable) {
    super();
  }

  _transform(chunk: Buffer | string, encoding: BufferEncoding, callback: TransformCallback): void {
    this.copy.write(chunk, encoding, (error) => callback(error ?? null, chunk));
  }

  _flush(callback: TransformCallback): void {
    this.copy.end(() => callback());
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    this.copy.destroy();
    callback(error);
  }
}

import { Transform, TransformCallback } from 'node:stream';
import type { WriteStream } from 'node:fs';

/**
 * Passes a body stream through unchanged while copying it into a file, so the body that was
 * actually sent can be shown in the request history. Each chunk is only passed on once it was
 * written, so a slow disk applies backpressure instead of buffering the body in memory.
 */
export class BodyRecorder extends Transform {
  private bytes = 0;
  private reported = false;

  /**
   * @param file the file to copy the body into. It is closed when the body ended or failed.
   * @param onRecorded called with the body size once the body was copied. If sending the body
   * failed, it is called with the size of the part that was sent.
   */
  constructor(
    private readonly file: WriteStream,
    private readonly onRecorded: (size: number) => void
  ) {
    super();
  }

  /** The number of bytes that passed through so far. */
  get size(): number {
    return this.bytes;
  }

  _transform(chunk: Buffer | string, encoding: BufferEncoding, callback: TransformCallback): void {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
    this.bytes += buffer.length;
    this.file.write(buffer, (error) => callback(error ?? null, chunk));
  }

  _flush(callback: TransformCallback): void {
    this.file.end(() => {
      this.report();
      callback();
    });
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    this.file.destroy();
    this.report();
    callback(error);
  }

  private report() {
    if (this.reported) return;
    this.reported = true;
    this.onRecorded(this.bytes);
  }
}

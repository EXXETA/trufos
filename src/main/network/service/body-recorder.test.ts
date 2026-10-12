import { describe, expect, it } from 'vitest';
import { PassThrough, Readable } from 'node:stream';
import { buffer, text } from 'node:stream/consumers';
import { BodyRecorder } from './body-recorder';

describe('BodyRecorder', () => {
  it('should pass the body through unchanged and copy it', async () => {
    // Arrange
    const copy = new PassThrough();
    const copied = text(copy);

    // Act
    const passed = await text(Readable.from(['{"a":', '1}']).pipe(new BodyRecorder(copy)));

    // Assert
    expect(passed).toBe('{"a":1}');
    await expect(copied).resolves.toBe('{"a":1}');
  });

  it('should copy binary bodies byte by byte', async () => {
    // Arrange
    const bytes = Buffer.from([0, 255, 1, 254]);
    const copy = new PassThrough();
    const copied = buffer(copy);

    // Act
    await text(Readable.from([bytes]).pipe(new BodyRecorder(copy)));

    // Assert
    await expect(copied).resolves.toEqual(bytes);
  });

  it('should destroy the copy if sending the body failed', () => {
    // Arrange
    const copy = new PassThrough();
    const recorder = new BodyRecorder(copy);

    // Act: in the app, the pipeline the recorder is part of handles the error
    recorder.on('error', () => {});
    recorder.destroy(new Error('connect ECONNREFUSED'));

    // Assert
    expect(copy.destroyed).toBe(true);
  });
});

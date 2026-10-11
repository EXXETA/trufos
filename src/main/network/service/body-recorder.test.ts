import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { BodyRecorder } from './body-recorder';

const FILE = path.join(tmpdir(), 'recorded-body');

const createRecorder = (onRecorded = vi.fn()) =>
  new BodyRecorder(fs.createWriteStream(FILE), onRecorded);

describe('BodyRecorder', () => {
  it('should pass the body through unchanged and copy it into the file', async () => {
    // Arrange
    const onRecorded = vi.fn();
    const recorder = createRecorder(onRecorded);

    // Act
    const passed = await text(Readable.from(['{"a":', '1}']).pipe(recorder));

    // Assert
    expect(passed).toBe('{"a":1}');
    expect(onRecorded).toHaveBeenCalledWith(7);
    expect(recorder.size).toBe(7);
    expect(fs.readFileSync(FILE, 'utf8')).toBe('{"a":1}');
  });

  it('should copy binary bodies byte by byte', async () => {
    // Arrange
    const bytes = Buffer.from([0, 255, 1, 254]);
    const recorder = createRecorder();

    // Act
    await text(Readable.from([bytes]).pipe(recorder));

    // Assert
    expect(fs.readFileSync(FILE)).toEqual(bytes);
  });

  it('should report the part that was sent if the body failed', async () => {
    // Arrange
    const onRecorded = vi.fn();
    const recorder = createRecorder(onRecorded);
    recorder.write('partial');
    await new Promise((resolve) => setImmediate(resolve));

    // Act: in the app, the pipeline the recorder is part of handles the error
    recorder.on('error', () => {});
    recorder.destroy(new Error('connect ECONNREFUSED'));

    // Assert
    await vi.waitFor(() => expect(onRecorded).toHaveBeenCalledWith(7));
  });
});

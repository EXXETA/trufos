import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { text } from 'node:stream/consumers';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { BodyStore } from './body-store';

const store = BodyStore.instance;

/** The bodies created by a test, deleted after it. */
const created: string[] = [];

/** Creates a body and finds its file, which the store keeps private, in the temp directory. */
function createBody(headers = {}) {
  const directory = FileSystemService.instance.temporaryDirectory;
  const before = new Set(fs.readdirSync(directory));
  const body = store.create(headers);
  created.push(body.id);
  const [file] = fs.readdirSync(directory).filter((name) => !before.has(String(name)));
  return { ...body, filePath: path.join(directory, String(file)) };
}

async function storeBody(content: string, headers = {}) {
  const body = createBody(headers);
  await pipeline(Readable.from([content]), body.stream);
  return body;
}

describe('BodyStore', () => {
  afterEach(() => {
    for (const id of created.splice(0)) store.remove(id);
  });

  it('should reference a body by its ID while it is written', () => {
    const { id } = store.create({ 'content-type': 'application/json' });

    expect(store.getHeaders(id)).toEqual({ 'content-type': 'application/json' });
    expect(store.getSize(id)).toBe(0);
  });

  it('should only store encrypted bodies on disk', async () => {
    const { id, filePath } = await storeBody('token=super-secret');

    expect(fs.readFileSync(filePath, 'utf8')).not.toContain('super-secret');
    expect(fs.statSync(filePath).size).toBe('token=super-secret'.length);
    expect(store.getSize(id)).toBe('token=super-secret'.length);
    await expect(text(store.openBody(id)!)).resolves.toBe('token=super-secret');
  });

  it('should only read the file up to the given end', async () => {
    const { id } = await storeBody('0123456789');

    await expect(text(store.openBody(id, { end: 3 })!)).resolves.toBe('0123');
  });

  it('should decrypt the body from any offset', async () => {
    const content = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const { id } = await storeBody(content);

    for (const [start, end] of [
      [1, 4],
      [15, 16],
      [16, 40],
      [33, content.length - 1],
    ]) {
      await expect(text(store.openBody(id, { start, end })!)).resolves.toBe(
        content.slice(start, end + 1)
      );
    }
    await expect(text(store.openBody(id, { start: 50 })!)).resolves.toBe(content.slice(50));
  });

  it('should decode the body with the given encoding', async () => {
    const { id } = await storeBody('hello');

    await expect(text(store.openBody(id, { encoding: 'base64' })!)).resolves.toBe('aGVsbG8=');
  });

  it('should save the decrypted body to a file', async () => {
    const { id } = await storeBody('plain body');
    const target = path.join(tmpdir(), 'download.txt');

    await store.saveTo(id, target);

    expect(fs.readFileSync(target, 'utf8')).toBe('plain body');
  });

  it('should not replace an existing file when saving exclusively', async () => {
    const { id } = await storeBody('new body');
    const target = path.join(tmpdir(), 'existing.txt');
    fs.writeFileSync(target, 'old');

    await expect(store.saveTo(id, target, { exclusive: true })).rejects.toThrow();

    expect(fs.readFileSync(target, 'utf8')).toBe('old');
  });

  it('should not open, measure or save unknown bodies', async () => {
    const id = randomUUID();

    expect(store.openBody(id)).toBeUndefined();
    expect(store.getSize(id)).toBeUndefined();
    expect(store.getHeaders(id)).toBeUndefined();
    await expect(store.saveTo(id, path.join(tmpdir(), 'x'))).resolves.toBeNull();
  });

  it('should delete a body', async () => {
    const { id, filePath } = await storeBody('body');

    store.remove(id);

    expect(fs.existsSync(filePath)).toBe(false);
    expect(store.getHeaders(id)).toBeUndefined();
  });

  it('should delete a body that is still written once writing ended', async () => {
    const { id, stream, filePath } = createBody();
    stream.write('partial');

    store.remove(id);
    expect(store.getHeaders(id)).toBeUndefined();
    expect(fs.existsSync(filePath)).toBe(true);

    stream.end();
    await vi.waitFor(() => expect(fs.existsSync(filePath)).toBe(false));
  });

  it('should forget all bodies on shutdown', async () => {
    const ids = [(await storeBody('a')).id, (await storeBody('b')).id];

    store.shutdown();

    expect(ids.map((id) => store.getHeaders(id))).toEqual([undefined, undefined]);
  });

  it('should delete a body once its last owner released it', async () => {
    const { id, filePath } = await storeBody('body');
    store.retain(id);
    store.retain(id);

    store.release(id);
    expect(fs.existsSync(filePath)).toBe(true);

    store.release(id);
    expect(fs.existsSync(filePath)).toBe(false);
    expect(store.getHeaders(id)).toBeUndefined();
  });
});

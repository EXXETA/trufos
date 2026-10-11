import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { text } from 'node:stream/consumers';
import { BodyStore } from './body-store';

const store = BodyStore.instance;

/** Creates a body and finds its file, which the store keeps private, in the temp directory. */
function createBody(headers = {}) {
  const before = new Set(fs.readdirSync(tmpdir()));
  const body = store.create(headers);
  const [file] = fs.readdirSync(tmpdir()).filter((name) => !before.has(String(name)));
  return { ...body, filePath: path.join(tmpdir(), String(file)) };
}

async function storeBody(content: string, headers = {}) {
  const body = createBody(headers);
  await pipeline(Readable.from([content]), body.stream);
  return body;
}

describe('BodyStore', () => {
  afterEach(() => {
    store.clear();
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
    // memfs ignores `end`, so only check that it reaches the file stream
    const { id, filePath } = await storeBody('0123456789');
    const createReadStream = vi.spyOn(fs, 'createReadStream');

    await text(store.openBody(id, { end: 3 })!);

    expect(createReadStream).toHaveBeenCalledWith(filePath, { end: 3 });
  });

  it('should decode the body with the given encoding', async () => {
    const { id } = await storeBody('hello');

    await expect(text(store.openBody(id, { encoding: 'base64' })!)).resolves.toBe('aGVsbG8=');
  });

  it('should save the decrypted body when downloading', async () => {
    const { id } = await storeBody('plain body');
    const target = path.join(tmpdir(), 'download.txt');

    await store.downloadResponse(id, target);

    expect(fs.readFileSync(target, 'utf8')).toBe('plain body');
  });

  it('should not open, measure or download unknown bodies', async () => {
    const id = randomUUID();

    expect(store.openBody(id)).toBeUndefined();
    expect(store.getSize(id)).toBeUndefined();
    expect(store.getHeaders(id)).toBeUndefined();
    await expect(store.downloadResponse(id, path.join(tmpdir(), 'x'))).resolves.toBeNull();
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

  it('should delete all bodies on shutdown', async () => {
    const filePaths = [(await storeBody('a')).filePath, (await storeBody('b')).filePath];

    store.shutdown();

    expect(filePaths.map((filePath) => fs.existsSync(filePath))).toEqual([false, false]);
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

import fs from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { text } from 'node:stream/consumers';
import { isSameOrInside, openFile, readFileLimited } from './fs-util';

/** The concurrent read limit that `readFileLimited()` is expected to enforce. */
const MAX_CONCURRENT_READS = 10;

/** A promise together with the functions that settle it, so tests control when a read finishes. */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Replaces `fs.readFile` with a mock that only settles when the test resolves the deferred it
 * handed out, so that reads can be held in flight for as long as needed.
 */
function mockPendingReads() {
  const deferreds: ReturnType<typeof createDeferred<string>>[] = [];
  const spy = vi.spyOn(fs, 'readFile').mockImplementation(() => {
    const deferred = createDeferred<string>();
    deferreds.push(deferred);
    return deferred.promise as ReturnType<typeof fs.readFile>;
  });
  return { deferreds, spy };
}

/** Lets all already scheduled microtasks run so that pending reads can start. */
async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('readFileLimited', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should read no more than the maximum number of files at once', async () => {
    const { deferreds, spy } = mockPendingReads();

    const reads = Array.from({ length: MAX_CONCURRENT_READS + 5 }, (_, i) =>
      readFileLimited(`/file-${i}`, 'utf8')
    );
    await flushMicrotasks();

    expect(spy).toHaveBeenCalledTimes(MAX_CONCURRENT_READS);

    deferreds.forEach((deferred, i) => deferred.resolve(`content-${i}`));
    await flushMicrotasks();
    deferreds.slice(MAX_CONCURRENT_READS).forEach((deferred, i) => deferred.resolve(`late-${i}`));

    await expect(Promise.all(reads)).resolves.toHaveLength(MAX_CONCURRENT_READS + 5);
    expect(spy).toHaveBeenCalledTimes(MAX_CONCURRENT_READS + 5);
  });

  it('should start a waiting read as soon as a running read finishes', async () => {
    const { deferreds, spy } = mockPendingReads();

    const reads = Array.from({ length: MAX_CONCURRENT_READS + 1 }, (_, i) =>
      readFileLimited(`/file-${i}`, 'utf8')
    );
    await flushMicrotasks();
    expect(spy).toHaveBeenCalledTimes(MAX_CONCURRENT_READS);

    deferreds[0].resolve('first');
    await flushMicrotasks();
    expect(spy).toHaveBeenCalledTimes(MAX_CONCURRENT_READS + 1);

    deferreds.slice(1).forEach((deferred, i) => deferred.resolve(`rest-${i}`));
    await Promise.all(reads);
  });

  it('should release the slot of a failed read', async () => {
    const { deferreds, spy } = mockPendingReads();

    const reads = Array.from({ length: MAX_CONCURRENT_READS + 1 }, (_, i) =>
      readFileLimited(`/file-${i}`, 'utf8')
    );
    await flushMicrotasks();

    deferreds[0].reject(new Error('read failed'));
    await expect(reads[0]).rejects.toThrow('read failed');
    await flushMicrotasks();

    expect(spy).toHaveBeenCalledTimes(MAX_CONCURRENT_READS + 1);
    deferreds.slice(1).forEach((deferred, i) => deferred.resolve(`rest-${i}`));
    await Promise.all(reads.slice(1));
  });

  it('should start waiting reads in the order they were requested', async () => {
    const { deferreds, spy } = mockPendingReads();

    const reads = Array.from({ length: MAX_CONCURRENT_READS + 3 }, (_, i) =>
      readFileLimited(`/file-${i}`, 'utf8')
    );
    await flushMicrotasks();

    for (let i = 0; i < 3; i++) {
      deferreds[i].resolve(`content-${i}`);
      await flushMicrotasks();
      expect(spy).toHaveBeenLastCalledWith(`/file-${MAX_CONCURRENT_READS + i}`, 'utf8');
    }

    deferreds.slice(3).forEach((deferred, i) => deferred.resolve(`rest-${i}`));
    await Promise.all(reads);
  });

  it('should return the file content decoded or as raw bytes', async () => {
    await fs.writeFile('/content.txt', 'file content', 'utf8');

    await expect(readFileLimited('/content.txt', 'utf8')).resolves.toBe('file content');
    await expect(readFileLimited('/content.txt')).resolves.toEqual(Buffer.from('file content'));
  });
});

describe('openFile', () => {
  it('should stream the file it opened even if the file is replaced afterwards', async () => {
    await fs.writeFile('/open.txt', 'before', 'utf8');
    const stream = await openFile('/open.txt', 'utf8');

    await fs.writeFile('/open.tmp', 'after', 'utf8');
    await fs.rename('/open.tmp', '/open.txt');

    await expect(text(stream!)).resolves.toBe('before');
  });

  it('should return undefined for a missing file', async () => {
    await expect(openFile('/missing.txt')).resolves.toBeUndefined();
  });
});

describe('isSameOrInside', () => {
  it('should match the directory itself and its descendants only', () => {
    expect(isSameOrInside('/a/b', '/a/b')).toBe(true);
    expect(isSameOrInside('/a/b/c/d', '/a/b')).toBe(true);
    expect(isSameOrInside('/a/bc', '/a/b')).toBe(false);
    expect(isSameOrInside('/a', '/a/b')).toBe(false);
  });
});

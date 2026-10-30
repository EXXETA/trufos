import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { completeUtf8Length, readPage } from './body-pages';

const bytesOf = (text: string) => Buffer.from(text, 'utf8');

describe('readPage', () => {
  it('should continue after a page that does not reach the end', async () => {
    const page = await readPage(Readable.from([bytesOf('hello')]), 10, 100);

    expect(page).toEqual({ text: 'hello', offset: 10, nextOffset: 15, totalSize: 100 });
  });

  it('should end with the last page', async () => {
    const page = await readPage(Readable.from([bytesOf('end')]), 97, 100);

    expect(page.nextOffset).toBeNull();
  });

  it('should be empty beyond the end of the body', async () => {
    const page = await readPage(Readable.from([]), 200, 100);

    expect(page).toEqual({ text: '', offset: 200, nextOffset: null, totalSize: 100 });
  });

  it('should not end inside a character, so the next page starts with it', async () => {
    // "€" has 3 bytes, the page ends after its first one
    const bytes = bytesOf('ab€').subarray(0, 3);

    const page = await readPage(Readable.from([bytes]), 0, 5);

    expect(page.text).toBe('ab');
    expect(page.nextOffset).toBe(2);
  });
});

describe('completeUtf8Length', () => {
  it.each([
    ['ascii', bytesOf('abc'), 3],
    ['a complete multi-byte character', bytesOf('a€'), 4],
    ['a cut off 2 byte character', bytesOf('aé').subarray(0, 2), 1],
    ['a cut off 4 byte character', bytesOf('a😀').subarray(0, 4), 1],
    ['a single incomplete character, which is kept to advance', bytesOf('€').subarray(0, 2), 2],
  ])('should handle %s', (_, bytes, expected) => {
    expect(completeUtf8Length(bytes)).toBe(expected);
  });
});

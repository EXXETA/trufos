import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cache, type CacheKey } from './cache';

describe('Cache', () => {
  let load: ReturnType<typeof vi.fn<(previous?: string) => Promise<string>>>;

  beforeEach(() => {
    load = vi.fn<(previous?: string) => Promise<string>>();
  });

  it('loads a value once and reuses it for equal keys', async () => {
    const cache = new Cache<string>();
    load.mockResolvedValueOnce('value');

    await cache.get(['a', 1, true, undefined], load);
    const result = await cache.get(['a', 1, true, undefined], load);

    expect(result).toBe('value');
    expect(load).toHaveBeenCalledOnce();
  });

  it.each<[string, CacheKey, CacheKey]>([
    ['different values', ['x'], ['y']],
    ['parts split differently', ['ab', 'c'], ['a', 'bc']],
    ['a separator inside a part', ['a;b'], ['a', 'b']],
    ['a string and a number', ['1'], [1]],
    ['a string and a boolean', ['true'], [true]],
    ['a string and undefined', ['undefined'], [undefined]],
    ['a string that looks like another part', ['number:1;'], [1]],
    ['undefined and an empty string', [undefined], ['']],
    ['an undefined part and no part', [undefined], []],
    ['a lone surrogate and the replacement character', ['\uD800'], ['\uFFFD']],
  ])('tells apart keys with %s', async (_, a, b) => {
    const cache = new Cache<string>();
    load.mockResolvedValueOnce('first').mockResolvedValueOnce('second');

    await cache.get(a, load);
    const result = await cache.get(b, load);

    expect(result).toBe('second');
  });

  it('loads a value once for concurrent calls', async () => {
    const cache = new Cache<string>();
    const { promise, resolve } = Promise.withResolvers<string>();
    load.mockReturnValueOnce(promise);

    const results = Promise.all([cache.get(['key'], load), cache.get(['key'], load)]);
    resolve('shared');

    expect(await results).toEqual(['shared', 'shared']);
    expect(load).toHaveBeenCalledOnce();
  });

  it('does not keep a failed load', async () => {
    const cache = new Cache<string>();
    load.mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce('second');

    await expect(cache.get(['key'], load)).rejects.toThrow('failed');
    const result = await cache.get(['key'], load);

    expect(result).toBe('second');
  });

  it('reloads a value that is no longer valid and passes it to the load', async () => {
    const cache = new Cache<string>({ isValid: (value) => value !== 'expired' });
    load.mockResolvedValueOnce('expired').mockResolvedValueOnce('fresh');

    await cache.get(['key'], load);
    const result = await cache.get(['key'], load);

    expect(result).toBe('fresh');
    expect(load).toHaveBeenLastCalledWith('expired');
  });

  it('disposes a value once it is replaced', async () => {
    const dispose = vi.fn();
    const cache = new Cache<string>({ isValid: () => false, dispose });
    load.mockResolvedValueOnce('first').mockResolvedValueOnce('second');

    await cache.get(['key'], load);
    await cache.get(['key'], load);

    await vi.waitFor(() => expect(dispose).toHaveBeenCalledExactlyOnceWith('first'));
  });

  it('evicts and disposes the oldest value beyond its capacity', async () => {
    const dispose = vi.fn();
    const cache = new Cache<string>({ capacity: 1, dispose });
    load.mockResolvedValueOnce('a').mockResolvedValueOnce('b').mockResolvedValueOnce('a again');

    await cache.get(['a'], load);
    await cache.get(['b'], load);
    const result = await cache.get(['a'], load);

    expect(result).toBe('a again');
    await vi.waitFor(() => expect(dispose.mock.calls).toEqual([['a'], ['b']]));
  });

  it('disposes all values when cleared', async () => {
    const dispose = vi.fn();
    const cache = new Cache<string>({ dispose });
    load.mockResolvedValueOnce('a').mockResolvedValueOnce('b').mockResolvedValueOnce('a again');

    await cache.get(['a'], load);
    await cache.get(['b'], load);
    cache.clear();
    const result = await cache.get(['a'], load);

    expect(result).toBe('a again');
    await vi.waitFor(() => expect(dispose.mock.calls).toEqual([['a'], ['b']]));
  });
});

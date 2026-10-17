import { hash } from 'node:crypto';

/** Identifies a cached value. Keys are compared by value. */
export type CacheKey = readonly (string | number | boolean | undefined)[];

export interface CacheOptions<V> {
  /** How many values are kept at most. Beyond it, the value loaded first is evicted. Unlimited by default. */
  capacity?: number;
  /** Whether a cached value can still be used. If not, it is loaded again. Always valid by default. */
  isValid?: (value: V) => boolean;
  /** Releases a value once it is replaced, evicted or cleared, e.g. closes a connection. */
  dispose?: (value: V) => unknown;
}

/**
 * Caches values loaded asynchronously. Keys are compared by value and kept as a hash, so a cache
 * does not hold secrets that are part of them. Concurrent calls for the same key share one load,
 * and a failed load is not kept.
 */
export class Cache<V> {
  /** The values by the hash of their key, in the order they were loaded. */
  private readonly entries = new Map<string, Promise<V>>();

  constructor(private readonly options: CacheOptions<V> = {}) {}

  /**
   * Returns the value for a key, loading it if it is not cached or no longer valid.
   * @param load loads the value. Gets the cached value if it is no longer valid, e.g. to renew it.
   */
  public async get(key: CacheKey, load: (previous?: V) => Promise<V>): Promise<V> {
    const id = hashOf(key);
    const pending = this.entries.get(id);
    const cached = await pending?.then(
      (value) => ({ value }),
      () => undefined
    );
    if (cached != null && (this.options.isValid?.(cached.value) ?? true)) return cached.value;

    // another call may have started loading the value meanwhile
    const current = this.entries.get(id);
    if (current != null && current !== pending) return await current;

    const loaded = load(cached?.value);
    this.set(id, loaded);
    loaded.catch(() => {
      if (this.entries.get(id) === loaded) this.entries.delete(id);
    });
    return await loaded;
  }

  /** Removes all values. */
  public clear(): void {
    for (const value of this.entries.values()) this.dispose(value);
    this.entries.clear();
  }

  private set(id: string, value: Promise<V>): void {
    const previous = this.entries.get(id);
    // deleted first, so the value counts as loaded last
    this.entries.delete(id);
    this.entries.set(id, value);
    if (previous != null) this.dispose(previous);

    for (const [oldestId, oldest] of this.entries) {
      if (this.entries.size <= (this.options.capacity ?? Infinity)) break;
      this.entries.delete(oldestId);
      this.dispose(oldest);
    }
  }

  /** Disposes a value once it is loaded. A value that failed to load has nothing to dispose. */
  private dispose(value: Promise<V>): void {
    const { dispose } = this.options;
    if (dispose == null) return;
    value
      .then(dispose, () => undefined)
      .catch((error: unknown) => logger.warn('Disposing a cached value failed:', error));
  }
}

/**
 * Hashes a key, so equal keys give the same hash. Each part is prefixed with its type, and strings
 * with their length, so different keys cannot give the same input. The input is hashed as UTF-16,
 * which keeps lone surrogates that UTF-8 would replace with U+FFFD.
 */
function hashOf(key: CacheKey): string {
  const parts = key.map((part) =>
    typeof part === 'string' ? `s${part.length}:${part}` : `${typeof part}:${part};`
  );
  return hash('sha256', Buffer.from(parts.join(''), 'utf16le'), 'hex');
}

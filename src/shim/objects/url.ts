/**
 * Represents a single query parameter entry. The value can be a string or a list of strings if the
 * same key appears multiple times. Keeping isActive for UI layer filtering.
 */
export type TrufosQueryEntry = {
  key: string;
  value: string | string[];
  isActive: boolean;
};

/**
 * Unified URL abstraction used in requests. It contains the base (without query string), the list
 * of headers that conceptually belong to the URL (rare; typically empty, but supported) and the
 * query entries with potential multi-values.
 */
export interface TrufosURL {
  /** URL without any query string */
  base: string;
  /** Query parameters with possible multi-values */
  query: TrufosQueryEntry[];
}

/** Create an empty URL object */
export function createEmptyUrl(base = 'http://'): TrufosURL {
  return {
    base,
    query: [],
  };
}

/** Parse a full URL string into a TrufosURL. */
export function parseUrl(full: string): TrufosURL {
  if (!full) return createEmptyUrl('');
  try {
    const urlObj = new URL(full);
    const base = full.substring(0, full.indexOf('?')) || urlObj.origin + urlObj.pathname;

    // Collect query params; group duplicate keys into string[]
    const grouped: Record<string, string[]> = {};
    for (const [key, value] of urlObj.searchParams.entries()) {
      if (!Reflect.has(grouped, key)) grouped[key] = [];
      grouped[key].push(value);
    }
    const query: TrufosQueryEntry[] = Object.entries(grouped).map(([key, values]) => ({
      key,
      value: values.length === 1 ? values[0] : values,
      isActive: true,
    }));

    return {
      base,
      query,
    };
  } catch {
    // Fallback: treat input as base only
    return createEmptyUrl(full);
  }
}

/** Serialize a TrufosURL into a string. Inactive query entries are skipped. */
export function buildUrl(url: TrufosURL): string {
  const params = new URLSearchParams();
  for (const entry of url.query) {
    if (!entry.isActive) continue;
    const values = Array.isArray(entry.value) ? entry.value : [entry.value];
    for (const v of values) params.append(entry.key, v);
  }
  const queryString = params.toString();
  return queryString ? `${url.base}?${queryString}` : url.base;
}

/** Return active query entries only */
export function getActiveQueryEntries(url: TrufosURL): TrufosQueryEntry[] {
  return url.query.filter((q) => q.isActive);
}

/** Add or replace a query entry. If merge=true and existing entry exists, merge values. */
export function upsertQueryEntry(
  url: TrufosURL,
  key: string,
  value: string | string[],
  opts: { merge?: boolean } = {}
): TrufosURL {
  const idx = url.query.findIndex((q) => q.key === key);
  if (idx === -1) {
    return { ...url, query: [...url.query, { key, value, isActive: true }] };
  }
  const current = url.query[idx];
  let newValue: string | string[] = value;
  if (opts.merge) {
    const existingValues = Array.isArray(current.value) ? current.value : [current.value];
    const incoming = Array.isArray(value) ? value : [value];
    newValue = [...existingValues, ...incoming];
  }
  const newQuery = [...url.query];
  newQuery[idx] = { ...current, value: newValue, isActive: true };
  return { ...url, query: newQuery };
}

/** Remove specific values or entire entry if predicate matches all (or no predicate given). */
export function removeQueryEntry(
  url: TrufosURL,
  key: string,
  predicate?: (value: string) => boolean
): TrufosURL {
  const idx = url.query.findIndex((q) => q.key === key);
  if (idx === -1) return url;
  const entry = url.query[idx];
  const values = Array.isArray(entry.value) ? entry.value : [entry.value];
  if (!predicate) {
    return { ...url, query: url.query.filter((_, i) => i !== idx) };
  }
  const remaining = values.filter((v) => !predicate(v));
  if (remaining.length === 0) {
    return { ...url, query: url.query.filter((_, i) => i !== idx) };
  }
  const newQuery = [...url.query];
  newQuery[idx] = { ...entry, value: remaining.length === 1 ? remaining[0] : remaining };
  return { ...url, query: newQuery };
}

/** Toggle active state of a query entry by index. */
export function toggleQueryEntry(url: TrufosURL, index: number): TrufosURL {
  if (index < 0 || index >= url.query.length) return url;
  const newQuery = [...url.query];
  newQuery[index] = { ...newQuery[index], isActive: !newQuery[index].isActive };
  return { ...url, query: newQuery };
}

/** Normalize URL: sort query keys, keep multi-value order stable. */
export function normalizeUrl(url: TrufosURL): TrufosURL {
  const sorted = [...url.query].sort((a, b) => a.key.localeCompare(b.key));
  return { ...url, query: sorted };
}

/** Convenience to clone deeply (query values). */
export function cloneUrl(url: TrufosURL): TrufosURL {
  return {
    base: url.base,
    query: url.query.map((q) => ({ ...q, value: Array.isArray(q.value) ? [...q.value] : q.value })),
  };
}

// Note: Header utilities intentionally removed; headers live on the request, not in the URL abstraction.

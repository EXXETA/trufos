import { TrufosQuery } from './query';

/**
 * Unified URL abstraction used in requests. It contains the base (without query string) and the query entries with potential multi-values.
 */
export interface TrufosURL {
  /** URL without any query string */
  base: string;
  /** Query parameters (duplicate keys allowed) */
  query: TrufosQuery[];
}

/**
 * Parse a full URL string into a TrufosURL.
 * @param full the full URL string
 */
export function parseUrl(full: string): TrufosURL {
  const [base, queryString] = full.split('?', 2);
  const query = new URLSearchParams(queryString)
    .entries()
    .map(([key, value]) => ({ key, value, isActive: true }))
    .toArray();
  return { base, query };
}

/**
 * Serialize a TrufosURL into a string. Inactive query entries are skipped.
 * @param url the {@link TrufosURL} object
 */
export function buildUrl(url: TrufosURL): string {
  const params = new URLSearchParams(
    url.query.filter((q) => q.isActive).map((q) => [q.key, q.value])
  );
  return params.size === 0 ? url.base : `${url.base}?${params}`;
}

/**
 * Check if two URLs are equal in all meaningful aspects.
 * @param url1 the first URL to compare
 * @param url2 the second URL to compare
 * @returns true if the URLs are equal, false otherwise
 */
export function urlsEqual(url1: TrufosURL, url2: TrufosURL) {
  if (url1.base !== url2.base) return false;
  if (url1.query.length !== url2.query.length) return false;

  for (let i = 0; i < url1.query.length; i++) {
    const q1 = url1.query[i];
    const q2 = url2.query[i];
    if (q1.key !== q2.key || q1.value !== q2.value || q1.isActive !== q2.isActive) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a URL is valid.
 * @param url The URL to check.
 * @returns True if the URL is valid, false otherwise.
 */
export function isUrlValid(url: TrufosURL) {
  return URL.canParse(url.base);
}

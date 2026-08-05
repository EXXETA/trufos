import { describe, expect, it } from 'vitest';
import { buildUrl, isUrlValid, parseUrl, TrufosURL, urlsEqual } from './url';

describe('TrufosUrl', () => {
  it.each<[string, TrufosURL]>([
    [
      'http://example.com?foo=bar',
      { base: 'http://example.com', query: [{ key: 'foo', value: 'bar', isActive: true }] },
    ],
    [
      'http://example.com?foo=bar&baz=qux',
      {
        base: 'http://example.com',
        query: [
          { key: 'foo', value: 'bar', isActive: true },
          { key: 'baz', value: 'qux', isActive: true },
        ],
      },
    ],
    ['http://example.com', { base: 'http://example.com', query: [] }],
    [
      'http://example.com?key&empty=',
      {
        base: 'http://example.com',
        query: [
          { key: 'key', value: undefined, isActive: true },
          { key: 'empty', value: '', isActive: true },
        ],
      },
    ],
    [
      'http://example.com?',
      {
        base: 'http://example.com',
        query: [{ key: '', value: undefined, isActive: true }],
      },
    ],
  ])('parseUrl($0) should parse correctly', (input, expected) => {
    // Act
    const result = parseUrl(input);

    // Assert
    expect(result).toEqual(expected);
  });

  it.each<[TrufosURL, string]>([
    [
      { base: 'http://example.com', query: [{ key: 'foo', value: 'bar', isActive: true }] },
      'http://example.com?foo=bar',
    ],
    [
      {
        base: 'http://example.com',
        query: [],
      },
      'http://example.com',
    ],
    [
      {
        base: 'http://example.com',
        query: [{ key: '', value: undefined, isActive: true }],
      },
      'http://example.com?',
    ],
    [
      {
        base: 'http://example.com',
        query: [
          { key: 'foo', value: 'bar', isActive: false },
          { key: 'baz', value: 'qux', isActive: true },
        ],
      },
      'http://example.com?baz=qux',
    ],
  ])('buildUrl() should build correct URL string', (url, expected) => {
    // Act
    const result = buildUrl(url);

    // Assert
    expect(result).toBe(expected);
  });

  it.each<[TrufosURL, TrufosURL, boolean]>([
    [
      { base: 'http://example.com', query: [{ key: 'foo', value: 'bar', isActive: true }] },
      { base: 'http://example.com', query: [{ key: 'foo', value: 'bar', isActive: true }] },
      true,
    ],
    [
      { base: 'http://example.com', query: [{ key: 'foo', value: 'bar', isActive: true }] },
      { base: 'http://example.com', query: [{ key: 'foo', value: 'baz', isActive: true }] },
      false,
    ],
    [
      { base: 'http://example.com', query: [{ key: 'foo', value: 'bar', isActive: true }] },
      { base: 'http://example.org', query: [{ key: 'foo', value: 'bar', isActive: true }] },
      false,
    ],
    [
      { base: 'http://example.com', query: [{ key: 'foo', value: 'bar', isActive: true }] },
      {
        base: 'http://example.com',
        query: [
          { key: 'foo', value: 'bar', isActive: true },
          { key: 'baz', value: 'qux', isActive: true },
        ],
      },
      false,
    ],
    [
      { base: 'http://example.com', query: [{ key: 'foo', value: '', isActive: true }] },
      { base: 'http://example.com', query: [{ key: 'foo', value: undefined, isActive: true }] },
      false,
    ],
  ])('urlsEqual() should return %s', (url1, url2, expected) => {
    // Act
    const result = urlsEqual(url1, url2);

    // Assert
    expect(result).toBe(expected);
  });

  it.each<[TrufosURL, string]>([
    [
      { base: 'http://example.com', query: [{ key: 'foo', value: 'bar', isActive: true }] },
      'http://example.com?foo=bar',
    ],
    [
      {
        base: 'http://example.com',
        query: [
          { key: 'foo', value: 'bar', isActive: true },
          { key: 'baz', value: 'qux', isActive: false },
        ],
      },
      'http://example.com?foo=bar',
    ],
    [{ base: 'http://example.com', query: [] }, 'http://example.com'],
    [
      {
        base: 'http://example.com',
        query: [
          { key: 'key', value: undefined, isActive: true },
          { key: 'empty', value: '', isActive: true },
        ],
      },
      'http://example.com?key&empty=',
    ],
  ])('buildUrl() should build correct URL string', (url, expected) => {
    // Act
    const result = buildUrl(url);

    // Assert
    expect(result).toBe(expected);
  });

  it.each<[string | null, boolean]>([
    ['https://api.example.com/users?id=123', true],
    ['not-a-valid-url', false],
    // a URL containing variables is only valid once they are resolved
    ['{{ baseUrl }}/users', false],
    // null means that the URL references a variable that is not defined
    [null, false],
  ])('isUrlValid(%s) should return %s', (resolvedUrl, expected) => {
    // Act
    const result = isUrlValid(resolvedUrl);

    // Assert
    expect(result).toBe(expected);
  });
});

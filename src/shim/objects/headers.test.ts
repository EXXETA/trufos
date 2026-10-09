import { describe, expect, it } from 'vitest';
import { isBlankHeader, isValidHeaderName } from './headers';

describe('isValidHeaderName', () => {
  it.each(['Content-Type', 'X-Api-Key', 'x_custom.header', "a!#$%&'*+-.^_`|~9"])(
    'accepts %s',
    (key) => {
      expect(isValidHeaderName(key)).toBe(true);
    }
  );

  it.each(['', 'My Header', 'X-Foo:', ' X-Foo', 'X-Föo', '{{ header }}'])('rejects "%s"', (key) => {
    expect(isValidHeaderName(key)).toBe(false);
  });
});

describe('isBlankHeader', () => {
  it('treats empty and whitespace-only keys as blank', () => {
    expect(isBlankHeader({ key: '', value: '', isActive: true })).toBe(true);
    expect(isBlankHeader({ key: '   ', value: 'x', isActive: true })).toBe(true);
  });

  it('does not treat a filled key as blank', () => {
    expect(isBlankHeader({ key: 'X-Foo', value: '', isActive: true })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { sanitizeVariableName, VARIABLE_NAME_REGEX } from './variables';

describe('sanitizeVariableName', () => {
  it('keeps names that already are valid variable names', () => {
    expect(sanitizeVariableName('appId')).toBe('appId');
    expect(sanitizeVariableName('app_id')).toBe('app_id');
    expect(sanitizeVariableName('app-id')).toBe('app-id');
  });

  it('replaces invalid characters with dashes', () => {
    expect(sanitizeVariableName('app.id')).toBe('app-id');
    expect(sanitizeVariableName('app id')).toBe('app-id');
    expect(sanitizeVariableName('app..id')).toBe('app-id');
  });

  it('removes leading and trailing dashes', () => {
    expect(sanitizeVariableName('.appId.')).toBe('appId');
  });

  it('prefixes names that start with a digit', () => {
    expect(sanitizeVariableName('2fa.code')).toBe('_2fa-code');
  });

  it('returns undefined if nothing usable remains', () => {
    expect(sanitizeVariableName('')).toBeUndefined();
    expect(sanitizeVariableName('...')).toBeUndefined();
    expect(sanitizeVariableName('идентификатор')).toBeUndefined();
  });

  it('always produces names that satisfy the variable name regex', () => {
    for (const name of ['app.id', ' user name ', '2fa', 'a--b', 'x.y.z', '_']) {
      const sanitized = sanitizeVariableName(name);
      expect(sanitized).toBeDefined();
      expect(sanitized).toMatch(VARIABLE_NAME_REGEX);
    }
  });
});

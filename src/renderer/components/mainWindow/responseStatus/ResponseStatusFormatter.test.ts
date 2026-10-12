import { getHttpStatusColorClass, getHttpStatusText } from './ResponseStatusFormatter';
import { describe, it, expect } from 'vitest';

describe('ResponseStatusFormatter', () => {
  describe('getHttpStatusColorClass', () => {
    it('returns neutral for status codes less than 200', () => {
      expect(getHttpStatusColorClass(199)).toBe('neutral');
    });

    it('returns success for status codes between 200 and 299', () => {
      expect(getHttpStatusColorClass(200)).toBe('success');
      expect(getHttpStatusColorClass(299)).toBe('success');
    });

    it('returns error for status codes 300 and above', () => {
      expect(getHttpStatusColorClass(300)).toBe('error');
      expect(getHttpStatusColorClass(500)).toBe('error');
    });
  });

  describe('getHttpStatusText', () => {
    it('returns the status text for known status codes', () => {
      expect(getHttpStatusText(200)).toBe('200 OK');
      expect(getHttpStatusText(404)).toBe('404 Not Found');
    });

    it('returns the status code as string for unknown status codes', () => {
      expect(getHttpStatusText(999)).toBe('999');
    });
  });
});

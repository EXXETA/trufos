import {
  getDurationTextInSec,
  getHttpStatusColorClass,
  getHttpStatusText,
  getSizeText,
} from './ResponseStatusFormatter';
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

  describe('getDurationTextinSec', () => {
    it('converts milliseconds to seconds with two decimal places', () => {
      expect(getDurationTextInSec(1234)).toBe('1.23 s');
      expect(getDurationTextInSec(1000)).toBe('1.00 s');
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

  describe('getSizeText', () => {
    it('converts bytes to kilobytes with two decimal places', () => {
      expect(getSizeText(1024)).toBe('1.02 KB');
      expect(getSizeText(2048)).toBe('2.05 KB');
    });

    it('converts bytes to megabytes with two decimal places', () => {
      expect(getSizeText(1048576)).toBe('1.05 MB');
      expect(getSizeText(2097152)).toBe('2.10 MB');
    });

    it('converts bytes to gigabytes with two decimal places', () => {
      expect(getSizeText(1073741824)).toBe('1.07 GB');
      expect(getSizeText(2147483648)).toBe('2.15 GB');
    });

    it('converts bytes to terabytes with two decimal places', () => {
      expect(getSizeText(1099511627776)).toBe('1.10 TB');
      expect(getSizeText(2199023255552)).toBe('2.20 TB');
    });

    it('returns bytes without conversion if less than 1000', () => {
      expect(getSizeText(999)).toBe('999 B');
    });

    it('handles edge case of exactly 1000 bytes', () => {
      expect(getSizeText(1000)).toBe('1.00 KB');
    });
  });
});

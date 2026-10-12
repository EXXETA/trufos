import { getDateTimeText, getDurationTextInSec, getSizeText } from './format-util';
import { describe, it, expect } from 'vitest';

describe('format-util', () => {
  describe('getDateTimeText', () => {
    it('formats the local date and time with zero padding', () => {
      expect(getDateTimeText(new Date(2026, 0, 2, 3, 4, 5).getTime())).toBe('2026-01-02 03:04:05');
      expect(getDateTimeText(new Date(2026, 9, 11, 22, 49, 0).getTime())).toBe(
        '2026-10-11 22:49:00'
      );
    });
  });

  describe('getDurationTextInSec', () => {
    it('converts milliseconds to seconds with two decimal places', () => {
      expect(getDurationTextInSec(1234)).toBe('1.23 s');
      expect(getDurationTextInSec(1000)).toBe('1.00 s');
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

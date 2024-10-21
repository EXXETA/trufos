import {
  getDurationTextInSec,
  getHttpStatusColorClass,
  getHttpStatusText,
  getSizeTextInKb,
} from './ResponseStatusFormatter';

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

  describe('getSizeTextInKb', () => {
    it('converts bytes to kilobytes with two decimal places', () => {
      expect(getSizeTextInKb(1024)).toBe('1.00 KB');
      expect(getSizeTextInKb(2048)).toBe('2.00 KB');
    });
  });
});
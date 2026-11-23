import { describe, it, expect } from 'vitest';
import {
  isFormattableLanguage,
  Language,
  languageToMimeType,
  mimeTypeToLanguage,
} from './mime-type';

describe('mime-type', () => {
  describe('mimeTypeToLanguage', () => {
    it.each<[string, Language]>([
      ['application/json', Language.JSON],
      ['text/json', Language.JSON],
      ['application/problem+json', Language.JSON],
      ['application/hal+json', Language.JSON],
      ['application/vnd.api+json', Language.JSON],
      ['application/vnd.github+json', Language.JSON],
      ['application/xml', Language.XML],
      ['text/xml', Language.XML],
      ['application/soap+xml', Language.XML],
      ['application/atom+xml', Language.XML],
      ['image/svg+xml', Language.XML],
      ['text/plain', Language.TEXT],
    ])('should map %s to %s', (mimeType, expected) => {
      // Act
      const result = mimeTypeToLanguage(mimeType);

      // Assert
      expect(result).toBe(expected);
    });

    it.each<[string, Language]>([
      ['APPLICATION/JSON', Language.JSON],
      ['Application/JSON; charset=utf-8', Language.JSON],
      [' text/json ; charset=utf-8 ', Language.JSON],
      ['Application/VND.Api+JSON; charset=UTF-8', Language.JSON],
      ['TEXT/XML; charset=iso-8859-1', Language.XML],
      ['Application/SOAP+XML;Charset=UTF-8', Language.XML],
      [' TEXT/PLAIN ; charset=utf-8 ', Language.TEXT],
    ])('should ignore parameters and casing when mapping %s', (mimeType, expected) => {
      // Act
      const result = mimeTypeToLanguage(mimeType);

      // Assert
      expect(result).toBe(expected);
    });

    it.each<string>([
      'text/html',
      'application/octet-stream',
      'application/jsonp',
      '+json',
      '+xml',
      'application/+json',
      'application/+xml',
      'application/vnd +json',
      '',
      '   ',
      '; charset=utf-8',
      'toString',
    ])('should return undefined when given unsupported or invalid MIME type %s', (mimeType) => {
      // Act
      const result = mimeTypeToLanguage(mimeType);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('languageToMimeType', () => {
    it('should preserve canonical MIME types for each Language', () => {
      // Assert
      expect(languageToMimeType(Language.JSON)).toBe('application/json');
      expect(languageToMimeType(Language.XML)).toBe('application/xml');
      expect(languageToMimeType(Language.TEXT)).toBe('text/plain');
    });
  });

  describe('isFormattableLanguage', () => {
    it('should report JSON and XML variants as formattable', () => {
      // Assert
      expect(isFormattableLanguage(mimeTypeToLanguage('application/soap+xml'))).toBe(true);
      expect(isFormattableLanguage(mimeTypeToLanguage('application/problem+json'))).toBe(true);
      expect(isFormattableLanguage(mimeTypeToLanguage('text/plain; charset=utf-8'))).toBe(false);
      expect(isFormattableLanguage(mimeTypeToLanguage('text/html'))).toBe(false);
    });
  });
});

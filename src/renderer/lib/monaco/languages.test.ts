import { describe, it, expect } from 'vitest';
import {
  Language,
  isFormattableLanguage,
  languageToMimeType,
  mimeTypeToLanguage,
} from './languages';

describe('languageToMimeType', () => {
  it('should map each language to its canonical MIME type', () => {
    // Act / Assert
    expect(languageToMimeType(Language.JSON)).toBe('application/json');
    expect(languageToMimeType(Language.XML)).toBe('application/xml');
    expect(languageToMimeType(Language.TEXT)).toBe('text/plain');
  });
});

describe('mimeTypeToLanguage', () => {
  it('should map the canonical MIME types', () => {
    // Act / Assert
    expect(mimeTypeToLanguage('application/json')).toBe(Language.JSON);
    expect(mimeTypeToLanguage('application/xml')).toBe(Language.XML);
    expect(mimeTypeToLanguage('text/plain')).toBe(Language.TEXT);
  });

  it('should ignore parameters after the media type', () => {
    // Act / Assert
    expect(mimeTypeToLanguage('application/json; charset=utf-8')).toBe(Language.JSON);
    expect(mimeTypeToLanguage('application/xml;charset=UTF-8')).toBe(Language.XML);
  });

  it('should ignore casing and surrounding whitespace', () => {
    // Act / Assert
    expect(mimeTypeToLanguage('Application/JSON')).toBe(Language.JSON);
    expect(mimeTypeToLanguage('APPLICATION/XML')).toBe(Language.XML);
    expect(mimeTypeToLanguage('  application/json  ')).toBe(Language.JSON);
  });

  it('should map text/xml and text/json to XML and JSON', () => {
    // Act / Assert
    expect(mimeTypeToLanguage('text/xml')).toBe(Language.XML);
    expect(mimeTypeToLanguage('text/json')).toBe(Language.JSON);
  });

  it('should map RFC 6839 +xml suffixes to XML', () => {
    // Act / Assert
    expect(mimeTypeToLanguage('application/soap+xml')).toBe(Language.XML);
    expect(mimeTypeToLanguage('application/atom+xml')).toBe(Language.XML);
  });

  it('should map RFC 6839 +json suffixes to JSON', () => {
    // Act / Assert
    expect(mimeTypeToLanguage('application/problem+json')).toBe(Language.JSON);
    expect(mimeTypeToLanguage('application/hal+json')).toBe(Language.JSON);
    expect(mimeTypeToLanguage('application/vnd.api+json')).toBe(Language.JSON);
  });

  it('should map any +xml suffix to XML, including image/svg+xml', () => {
    // The suffix decides, so an SVG body is XML and can be highlighted as such.
    // Act / Assert
    expect(mimeTypeToLanguage('image/svg+xml')).toBe(Language.XML);
  });

  it('should map by suffix, not by the base name alone', () => {
    // `text/x+plain` is not `text/plain`; only known types and the structured suffixes are recognised.
    // Act / Assert
    expect(mimeTypeToLanguage('text/x+plain')).toBeUndefined();
  });

  it('should not treat inherited object properties as a language', () => {
    // A plain-object lookup would return Object for these.
    // Act / Assert
    expect(mimeTypeToLanguage('constructor')).toBeUndefined();
    expect(mimeTypeToLanguage('__proto__')).toBeUndefined();
    expect(mimeTypeToLanguage('toString')).toBeUndefined();
  });

  it('should return undefined for an unknown media type', () => {
    // Act / Assert
    expect(mimeTypeToLanguage('image/png')).toBeUndefined();
    expect(mimeTypeToLanguage('text/html')).toBeUndefined();
  });

  it('should return undefined for an empty or blank string', () => {
    // Act / Assert
    expect(mimeTypeToLanguage('')).toBeUndefined();
    expect(mimeTypeToLanguage('   ')).toBeUndefined();
  });
});

describe('isFormattableLanguage', () => {
  it('should accept JSON and XML', () => {
    // Act / Assert
    expect(isFormattableLanguage(Language.JSON)).toBe(true);
    expect(isFormattableLanguage(Language.XML)).toBe(true);
  });

  it('should reject plain text and undefined', () => {
    // Act / Assert
    expect(isFormattableLanguage(Language.TEXT)).toBe(false);
    expect(isFormattableLanguage(undefined)).toBe(false);
  });
});

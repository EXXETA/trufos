import { describe, it, expect, vi } from 'vitest';

// `language.ts` registers Monaco providers as a side effect of being imported.
// Mock Monaco and the providers so the pure MIME-type helpers can be tested
// without a real editor environment.
vi.mock('monaco-editor', () => ({
  languages: {
    setMonarchTokensProvider: vi.fn(),
    registerDocumentSemanticTokensProvider: vi.fn(),
    registerCompletionItemProvider: vi.fn(),
    registerHoverProvider: vi.fn(),
    registerDocumentFormattingEditProvider: vi.fn(),
  },
  typescript: {
    javascriptDefaults: { addExtraLib: vi.fn() },
  },
}));
vi.mock('xml-formatter', () => ({ default: vi.fn((text: string) => text) }));
vi.mock('@/assets/trufos-scripting-api.d.ts?raw', () => ({
  default: 'declare const trufos: unknown;',
}));

import { Language, languageToMimeType, mimeTypeToLanguage } from './language';

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

  it('should ignore casing', () => {
    // Act / Assert
    expect(mimeTypeToLanguage('Application/JSON')).toBe(Language.JSON);
    expect(mimeTypeToLanguage('APPLICATION/XML')).toBe(Language.XML);
  });

  it('should trim surrounding whitespace', () => {
    // Act / Assert
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

  it('should combine suffixes with parameters and casing', () => {
    // Act / Assert
    expect(mimeTypeToLanguage('Application/Problem+JSON; charset=utf-8')).toBe(Language.JSON);
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

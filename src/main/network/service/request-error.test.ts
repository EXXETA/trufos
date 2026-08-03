import { describe, it, expect } from 'vitest';
import { DisplayableError } from 'shim/error/DisplayableError';
import { mapRequestError } from './request-error';

/** Build a Node-style system error with a `code` (and optional extra props). */
function systemError(code: string, extra: Record<string, unknown> = {}): Error {
  return Object.assign(new Error(code), { code, ...extra });
}

describe('mapRequestError', () => {
  it('always returns a DisplayableError', () => {
    expect(mapRequestError(new Error('boom'))).toBeInstanceOf(DisplayableError);
    expect(mapRequestError('not even an error')).toBeInstanceOf(DisplayableError);
    expect(mapRequestError(undefined)).toBeInstanceOf(DisplayableError);
  });

  it('keeps the original error as the cause', () => {
    const original = systemError('ECONNRESET');
    expect(mapRequestError(original).cause).toBe(original);
  });

  it('reads the error code from the cause when the top-level error has none', () => {
    const wrapped = Object.assign(new Error('fetch failed'), {
      cause: systemError('ECONNREFUSED'),
    });
    expect(mapRequestError(wrapped).title).toBe('Connection Refused');
  });

  describe('DNS resolution failures', () => {
    it.each(['ENOTFOUND', 'EAI_AGAIN'])('maps DNS code %s to Host Not Found', (code) => {
      expect(mapRequestError(systemError(code)).title).toBe('Host Not Found');
    });
  });

  describe('connection failures', () => {
    it('maps ECONNREFUSED', () => {
      expect(mapRequestError(systemError('ECONNREFUSED')).title).toBe('Connection Refused');
    });

    it('maps ECONNRESET', () => {
      expect(mapRequestError(systemError('ECONNRESET')).title).toBe('Connection Reset');
    });

    it.each([
      'ETIMEDOUT',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT',
    ])('maps timeout code %s', (code) => {
      expect(mapRequestError(systemError(code)).title).toBe('Request Timed Out');
    });
  });

  describe('invalid URL', () => {
    it('maps the ERR_INVALID_URL code', () => {
      expect(mapRequestError(systemError('ERR_INVALID_URL')).title).toBe('Invalid URL');
    });

    it('maps undici\'s "invalid url" message', () => {
      expect(mapRequestError(new Error('invalid url')).title).toBe('Invalid URL');
    });
  });

  describe('certificate failures', () => {
    it.each([
      'CERT_HAS_EXPIRED',
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'SELF_SIGNED_CERT_IN_CHAIN',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'ERR_TLS_CERT_ALTNAME_INVALID',
    ])('maps certificate code %s', (code) => {
      expect(mapRequestError(systemError(code)).title).toBe('Certificate Error');
    });
  });

  it('falls back to a generic message for unknown errors', () => {
    const error = mapRequestError(systemError('ESOMETHINGWEIRD'));
    expect(error.title).toBe('Could not send Request');
    expect(error.description.length).toBeGreaterThan(0);
  });
});

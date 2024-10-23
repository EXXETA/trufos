import { calculateResponseSize } from './size-calculation';

jest.mock('node:fs', () => ({
  statSync: () => ({ size: 500 }),
}));

describe('calculateResponseSize', () => {
  it('calculates size correctly with valid headers and file path', () => {
    const headers = { 'content-length': '100', 'content-type': 'application/json' };
    const filePath = 'path/to/file';
    //jest.spyOn(fs, 'statSync').mockReturnValue({ size: 100 } as fs.Stats);
    const result = calculateResponseSize(headers, filePath);
    expect(result).toEqual({
      totalSizeInBytes: 153,
      headersSizeInBytes: 53,
      bodySizeInBytes: 100,
    });
  });

  it('calculates size correctly with valid content-length header and no file path', () => {
    const headers = { 'content-length': '100', 'content-type': 'application/json' };
    const result = calculateResponseSize(headers);
    expect(result).toEqual({
      totalSizeInBytes: 153,
      headersSizeInBytes: 53,
      bodySizeInBytes: 100,
    });
  });

  it('calculates size correctly with no content-length header and valid file path', () => {
    const headers = { 'content-type': 'application/json' };
    const filePath = 'path/to/file';
    const result = calculateResponseSize(headers, filePath);
    expect(result).toEqual({
      totalSizeInBytes: 532,
      headersSizeInBytes: 32,
      bodySizeInBytes: 500,
    });
  });

  it('calculates size correctly with no content-length header and no file path', () => {
    const headers = { 'content-type': 'application/json' };
    const result = calculateResponseSize(headers);
    expect(result).toEqual({
      totalSizeInBytes: 32,
      headersSizeInBytes: 32,
      bodySizeInBytes: 0,
    });
  });

  it('calculates size correctly with multiple header values', () => {
    const headers = {
      'set-cookie': ['cookie1=value1', 'cookie2=value2'],
      'content-type': 'application/json',
    };
    const result = calculateResponseSize(headers);
    expect(result).toEqual({
      totalSizeInBytes: 76,
      headersSizeInBytes: 76,
      bodySizeInBytes: 0,
    });
  });

  it('calculates size of header correctly for several cases combined', () => {
    const headers = {
      Date: 'Tue, 22 Oct 2024 08:47:51 GMT',
      Expires: '-1',
      'Cache-Control': ['private', 'max-age=0'],
      'Content-Type': 'text/html; charset=ISO-8859-1',
      'Content-Security-Policy-Report-Only':
        "object-src 'none';base-uri 'self';script-src 'nonce-PiU4uUsxJHMfI86u0fq6eA' 'strict-dynamic' 'report-sample' 'unsafe-eval' 'unsafe-inline' https: http:;report-uri https://csp.withgoogle.com/csp/gws/other-hp",
      Server: 'gws',
      'X-XSS-Protection': '0',
      'X-Frame-Options': 'SAMEORIGIN',
      'Set-Cookie': [
        'AEC=AVYB7cpFDNfvuiVCfhVB5CNosUmOPykRrb9AaXhY-Erip_-YyWGHFC5gPMc; expires=Sun, 20-Apr-2025 08:47:51 GMT; path=/; domain=.google.de; Secure; HttpOnly; SameSite=lax',
      ],
      'Accept-Ranges': 'none',
      Vary: 'Accept-Encoding',
      'Transfer-Encoding': 'chunked',
    };
    const result = calculateResponseSize(headers);
    expect(result).toEqual({
      totalSizeInBytes: 685,
      headersSizeInBytes: 685,
      bodySizeInBytes: 0,
    });
  });
});

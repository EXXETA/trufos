import { describe, expect, it } from 'vitest';
import { checkAccess } from './access-check';

const isValidToken = (token: string) => token === 'secret';

const VALID = {
  url: '/mcp',
  headers: { host: '127.0.0.1:7357', authorization: 'Bearer secret' },
};

describe('checkAccess', () => {
  it('should let a local request with the token through', () => {
    expect(checkAccess(VALID, isValidToken)).toBeUndefined();
    expect(
      checkAccess({ ...VALID, headers: { ...VALID.headers, host: 'localhost:7357' } }, isValidToken)
    ).toBeUndefined();
  });

  it('should reject a foreign host, e.g. of a DNS rebinding attack', () => {
    const rejection = checkAccess(
      { ...VALID, headers: { ...VALID.headers, host: 'evil.example:7357' } },
      isValidToken
    );

    expect(rejection?.status).toBe(403);
  });

  it('should reject requests of foreign web pages', () => {
    const rejection = checkAccess(
      { ...VALID, headers: { ...VALID.headers, origin: 'https://evil.example' } },
      isValidToken
    );

    expect(rejection?.status).toBe(403);
  });

  it('should accept requests of local web pages', () => {
    expect(
      checkAccess(
        { ...VALID, headers: { ...VALID.headers, origin: 'http://localhost:6274' } },
        isValidToken
      )
    ).toBeUndefined();
  });

  it('should reject other paths', () => {
    expect(checkAccess({ ...VALID, url: '/other' }, isValidToken)?.status).toBe(404);
    expect(checkAccess({ ...VALID, url: '/mcp?x=1' }, isValidToken)).toBeUndefined();
  });

  it.each([
    ['without a token', undefined],
    ['with a wrong token', 'Bearer wrong'],
    ['with another scheme', 'Basic secret'],
  ])('should reject requests %s', (_, authorization) => {
    const rejection = checkAccess(
      { ...VALID, headers: { host: VALID.headers.host, authorization } },
      isValidToken
    );

    expect(rejection).toMatchObject({ status: 401, headers: { 'WWW-Authenticate': 'Bearer' } });
  });
});

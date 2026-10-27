import { describe, expect, it } from 'vitest';
import { parseChallenges } from './challenge';

describe('parseChallenges()', () => {
  it('parses a Digest challenge with quoted and unquoted parameters', () => {
    expect(
      parseChallenges([
        'Digest realm="http-auth@example.org", qop="auth, auth-int", algorithm=SHA-256, nonce="abc"',
      ])
    ).toEqual([
      {
        scheme: 'digest',
        params: {
          realm: 'http-auth@example.org',
          qop: 'auth, auth-int',
          algorithm: 'SHA-256',
          nonce: 'abc',
        },
      },
    ]);
  });

  it('parses several challenges in one header and across headers', () => {
    const challenges = parseChallenges([
      'Digest realm="a", nonce="1", algorithm=SHA-256, Digest realm="a", nonce="2"',
      'Basic realm="b"',
    ]);

    expect(challenges).toEqual([
      { scheme: 'digest', params: { realm: 'a', nonce: '1', algorithm: 'SHA-256' } },
      { scheme: 'digest', params: { realm: 'a', nonce: '2' } },
      { scheme: 'basic', params: { realm: 'b' } },
    ]);
  });

  it('unescapes quoted strings and reads parameter names case-insensitively', () => {
    expect(parseChallenges(['DIGEST Realm="say \\"hi\\", \\\\ok"'])).toEqual([
      { scheme: 'digest', params: { realm: 'say "hi", \\ok' } },
    ]);
  });

  it('skips token68 challenges and challenges without parameters', () => {
    expect(parseChallenges(['Negotiate abc==, NTLM, Digest realm="a"'])).toEqual([
      { scheme: 'negotiate', params: {} },
      { scheme: 'ntlm', params: {} },
      { scheme: 'digest', params: { realm: 'a' } },
    ]);
  });

  it('returns nothing for empty headers', () => {
    expect(parseChallenges(['', ' , '])).toEqual([]);
  });
});

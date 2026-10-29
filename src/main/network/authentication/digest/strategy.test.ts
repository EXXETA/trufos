import { describe, expect, it, vi } from 'vitest';
import { AuthorizationType, DigestAuthorizationInformation } from 'shim/objects';
import { DisplayableError } from 'shim/error/DisplayableError';
import { RequestMethod } from 'shim/objects/request-method';
import { makeAuthRequestContext } from '../__mocks__/auth-request-context';
import DigestAuthStrategy, { createDigestHeader, selectDigestChallenge } from './strategy';

// the example of RFC 7616 §3.9.1
const RFC_7616 = {
  credentials: { username: 'Mufasa', password: 'Circle of Life' },
  request: { method: RequestMethod.GET, uri: '/dir/index.html' },
  cnonce: 'f2/wE4q74E6zIJEtWaHKaf5wv/H5QzzpXusqGemxURZJ',
  challenge: (algorithm: string) =>
    `Digest realm="http-auth@example.org", qop="auth, auth-int", algorithm=${algorithm}, ` +
    'nonce="7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v", ' +
    'opaque="FQhe/qaU925kfnzjCev0ciny7QMkPqMAFRtzCUYo5tdS"',
};

/** Returns the parameters of a Digest header. Values in the tests contain no commas. */
function parseHeader(header: string): Record<string, string> {
  expect(header).toMatch(/^Digest /);
  return Object.fromEntries(
    header
      .slice('Digest '.length)
      .split(', ')
      .map((param) => {
        const [key, value] = param.split(/=(.*)/);
        return [key, value.replace(/^"(.*)"$/, '$1')];
      })
  );
}

describe('selectDigestChallenge()', () => {
  it('selects the challenge with the strongest supported algorithm', () => {
    const challenge = selectDigestChallenge([
      RFC_7616.challenge('MD5'),
      RFC_7616.challenge('SHA-256-sess'),
      RFC_7616.challenge('SHA-1'),
    ]);

    expect(challenge?.algorithm).toMatchObject({
      name: 'SHA-256-sess',
      hash: 'sha256',
      session: true,
    });
  });

  it('defaults to MD5 without qop for legacy challenges', () => {
    expect(selectDigestChallenge(['Digest realm="r", nonce="n"'])).toEqual({
      realm: 'r',
      nonce: 'n',
      opaque: undefined,
      algorithm: { name: undefined, hash: 'md5', session: false, strength: 0 },
      hasQop: false,
    });
  });

  it.each([
    ['other schemes', 'Basic realm="r"'],
    ['unsupported algorithms', 'Digest realm="r", nonce="n", algorithm=SHA-1'],
    ['qop=auth-int only', 'Digest realm="r", nonce="n", qop="auth-int"'],
    ['a missing nonce', 'Digest realm="r"'],
  ])('ignores challenges with %s', (_, header) => {
    expect(selectDigestChallenge([header])).toBeUndefined();
  });
});

describe('createDigestHeader()', () => {
  it.each([
    ['MD5', '8ca523f5e9506fed4657c9700eebdbec'],
    ['SHA-256', '753927fa0e85d155564e2e272a28d1802ca10daf4496794697cf8db5856cb6c1'],
  ])('computes the response of RFC 7616 for %s', (algorithm, response) => {
    const challenge = selectDigestChallenge([RFC_7616.challenge(algorithm)])!;

    const header = createDigestHeader(
      challenge,
      RFC_7616.credentials,
      RFC_7616.request,
      RFC_7616.cnonce
    );

    expect(parseHeader(header)).toEqual({
      username: 'Mufasa',
      realm: 'http-auth@example.org',
      nonce: '7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v',
      uri: '/dir/index.html',
      algorithm,
      response,
      opaque: 'FQhe/qaU925kfnzjCev0ciny7QMkPqMAFRtzCUYo5tdS',
      qop: 'auth',
      nc: '00000001',
      cnonce: RFC_7616.cnonce,
    });
  });

  it('computes the legacy RFC 2069 response without qop', () => {
    // RFC 2069 §2.4 with the response computed for its example values
    const challenge = selectDigestChallenge([
      'Digest realm="testrealm@host.com", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093"',
    ])!;

    const header = createDigestHeader(
      challenge,
      { username: 'Mufasa', password: 'CircleOfLife' },
      { method: RequestMethod.GET, uri: '/dir/index.html' },
      'unused'
    );

    expect(parseHeader(header)).toEqual({
      username: 'Mufasa',
      realm: 'testrealm@host.com',
      nonce: 'dcd98b7102dd2f0e8b11d0f600bfb0c093',
      uri: '/dir/index.html',
      response: '1949323746fe6a43ef61f9606e7febea',
    });
  });

  it('escapes quotes in the username', () => {
    const challenge = selectDigestChallenge(['Digest realm="r", nonce="n"'])!;

    const header = createDigestHeader(
      challenge,
      { username: 'a"b', password: '' },
      { method: RequestMethod.GET, uri: '/' },
      'c'
    );

    expect(header).toContain('username="a\\"b"');
  });
});

describe('DigestAuthStrategy', () => {
  const auth: DigestAuthorizationInformation = {
    type: AuthorizationType.DIGEST,
    ...RFC_7616.credentials,
  };

  it('answers the challenge of the server for the request target', async () => {
    const getChallenges = vi.fn().mockResolvedValue([RFC_7616.challenge('SHA-256')]);

    const header = await new DigestAuthStrategy(auth).getAuthHeader(
      makeAuthRequestContext({
        method: RequestMethod.POST,
        url: 'https://example.org/dir/index.html?a=1#fragment',
        getChallenges,
      })
    );

    expect(getChallenges).toHaveBeenCalledOnce();
    const params = parseHeader(header);
    expect(params).toMatchObject({ uri: '/dir/index.html?a=1', qop: 'auth', nc: '00000001' });
    expect(params.cnonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('fails if the server does not ask for authentication', async () => {
    const strategy = new DigestAuthStrategy(auth);

    await expect(strategy.getAuthHeader(makeAuthRequestContext())).rejects.toBeInstanceOf(
      DisplayableError
    );
  });

  it('fails if the server sends no supported challenge', async () => {
    const strategy = new DigestAuthStrategy(auth);

    await expect(
      strategy.getAuthHeader(
        makeAuthRequestContext({ getChallenges: async () => ['Basic realm="r"'] })
      )
    ).rejects.toThrow('Basic realm="r"');
  });
});

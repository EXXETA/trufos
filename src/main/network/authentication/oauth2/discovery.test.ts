import { beforeEach, describe, expect, it } from 'vitest';
import { MockAgent } from 'undici';
import { DisplayableError } from 'shim/error/DisplayableError';
import { discoverOAuth2Endpoints } from './discovery';

const ISSUER = 'https://auth.example.com/realms/test';
const METADATA_PATH = '/realms/test/.well-known/openid-configuration';
const JSON_HEADERS = { headers: { 'content-type': 'application/json' } };

describe('discoverOAuth2Endpoints', () => {
  let agent: MockAgent;

  beforeEach(() => {
    agent = new MockAgent();
    agent.disableNetConnect();
  });

  const replyWith = (status: number, body: object, origin = 'https://auth.example.com') =>
    agent
      .get(origin)
      .intercept({ path: METADATA_PATH })
      .reply(status, JSON.stringify(body), JSON_HEADERS);

  const discover = (issuerUrl = ISSUER) => discoverOAuth2Endpoints(issuerUrl, agent);

  const discoverError = async (issuerUrl = ISSUER) => {
    const error: unknown = await discover(issuerUrl).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DisplayableError);
    return error as DisplayableError;
  };

  it('returns the published endpoints', async () => {
    replyWith(200, {
      issuer: ISSUER,
      token_endpoint: `${ISSUER}/token`,
      authorization_endpoint: `${ISSUER}/authorize`,
    });

    await expect(discover()).resolves.toEqual({
      tokenUrl: `${ISSUER}/token`,
      authorizationUrl: `${ISSUER}/authorize`,
    });
  });

  it('leaves out an authorization endpoint the server does not publish', async () => {
    replyWith(200, { issuer: ISSUER, token_endpoint: `${ISSUER}/token` });

    await expect(discover()).resolves.toEqual({ tokenUrl: `${ISSUER}/token` });
  });

  it('allows plain HTTP issuers', async () => {
    const issuer = 'http://localhost:8080/realms/test';
    replyWith(200, { issuer, token_endpoint: `${issuer}/token` }, 'http://localhost:8080');

    await expect(discover(issuer)).resolves.toEqual({ tokenUrl: `${issuer}/token` });
  });

  it('sends the request with the given dispatcher', async () => {
    replyWith(200, { issuer: ISSUER, token_endpoint: `${ISSUER}/token` });

    await discover();

    agent.assertNoPendingInterceptors();
  });

  it('names both issuers if the server reports another one', async () => {
    replyWith(200, { issuer: 'https://other.example.com', token_endpoint: `${ISSUER}/token` });

    const error = await discoverError();

    expect(error.title).toBe('Issuer Mismatch');
    expect(error.description).toContain('https://other.example.com');
    expect(error.description).toContain(ISSUER);
  });

  it('reports a server without a token endpoint', async () => {
    replyWith(200, { issuer: ISSUER });

    expect((await discoverError()).description).toContain('token endpoint');
  });

  it('reports an error response', async () => {
    replyWith(404, {});

    const error = await discoverError();

    expect(error.title).toBe('Discovery Failed');
    expect(error.description).toContain(ISSUER);
  });

  it('reports a failed connection', async () => {
    agent
      .get('https://auth.example.com')
      .intercept({ path: METADATA_PATH })
      .replyWithError(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }));

    expect((await discoverError()).title).toBe('Connection Refused');
  });

  it.each(['not a url', 'ftp://auth.example.com'])('rejects the URL "%s"', async (issuerUrl) => {
    expect((await discoverError(issuerUrl)).title).toBe('Invalid Issuer URL');
  });
});

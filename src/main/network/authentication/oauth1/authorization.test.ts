import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AuthorizationType,
  OAuth1AuthorizationFlowInformation,
  OAuth1Method,
  OAuth1SignatureMethod,
} from 'shim/objects';
import AuthorizationOAuth1Strategy from './authorization';

const NONCE = 'fixednonce';
const TIMESTAMP = '1234567890';
const VERIFIER = 'verifier123';
const CALLBACK = 'http://localhost/callback';

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function parseOAuthHeader(header: string): Record<string, string> {
  expect(header.startsWith('OAuth ')).toBe(true);
  const params: Record<string, string> = {};
  for (const part of header.slice('OAuth '.length).split(', ')) {
    const match = part.match(/^([^=]+)="(.*)"$/);
    expect(match).not.toBeNull();
    params[decodeURIComponent(match![1])] = decodeURIComponent(match![2]);
  }
  return params;
}

function hmacSha1(baseString: string, signingKey: string): string {
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function baseAuth(
  overrides: Partial<OAuth1AuthorizationFlowInformation> = {}
): OAuth1AuthorizationFlowInformation {
  return {
    type: AuthorizationType.OAUTH1,
    method: OAuth1Method.AUTHORIZATION,
    consumerKey: 'ck',
    consumerSecret: 'cs',
    signatureMethod: OAuth1SignatureMethod.HMAC_SHA1,
    requestTokenUrl: 'https://example.com/oauth/request_token',
    authorizationUrl: 'https://example.com/oauth/authorize',
    accessTokenUrl: 'https://example.com/oauth/access_token',
    callbackUrl: CALLBACK,
    ...overrides,
  };
}

/** Strategy that stubs out the network (postForm) and browser (authorize) steps. */
class TestAuthorizationStrategy extends AuthorizationOAuth1Strategy {
  public calls: { url: string; header: string }[] = [];
  private readonly responses: string[];

  constructor(auth: OAuth1AuthorizationFlowInformation, responses: string[]) {
    super(auth);
    this.responses = responses;
  }

  protected generateNonce() {
    return NONCE;
  }
  protected generateTimestamp() {
    return TIMESTAMP;
  }
  protected async postForm(url: URL, header: string): Promise<URLSearchParams> {
    this.calls.push({ url: url.href, header });
    return new URLSearchParams(this.responses[this.calls.length - 1]);
  }
  protected async authorize(): Promise<string> {
    return VERIFIER;
  }

  // expose protected methods for focused testing
  public runRequestToken() {
    return this['requestToken']();
  }
  public runAccessToken(temp: { token: string; tokenSecret: string }, verifier: string) {
    return this['accessToken'](temp, verifier);
  }
}

describe('AuthorizationOAuth1Strategy', () => {
  it('signs the temporary-credentials request with an empty token secret and oauth_callback', async () => {
    const strategy = new TestAuthorizationStrategy(baseAuth(), [
      'oauth_token=tmp&oauth_token_secret=tmps&oauth_callback_confirmed=true',
    ]);

    const result = await strategy.runRequestToken();

    expect(result).toEqual({ token: 'tmp', tokenSecret: 'tmps' });
    expect(strategy.calls[0].url).toBe('https://example.com/oauth/request_token');

    const params = parseOAuthHeader(strategy.calls[0].header);
    expect(params.oauth_callback).toBe(CALLBACK);
    expect(params.oauth_token).toBeUndefined();

    const normalized = [
      `oauth_callback=${percentEncode(CALLBACK)}`,
      'oauth_consumer_key=ck',
      `oauth_nonce=${NONCE}`,
      'oauth_signature_method=HMAC-SHA1',
      `oauth_timestamp=${TIMESTAMP}`,
      'oauth_version=1.0',
    ].join('&');
    const baseString = `POST&${percentEncode('https://example.com/oauth/request_token')}&${percentEncode(normalized)}`;
    expect(params.oauth_signature).toBe(hmacSha1(baseString, 'cs&'));
  });

  it('signs the access-token request with the temporary token, secret and oauth_verifier', async () => {
    const strategy = new TestAuthorizationStrategy(baseAuth(), [
      'oauth_token=acc&oauth_token_secret=accs',
    ]);

    const result = await strategy.runAccessToken({ token: 'tmp', tokenSecret: 'tmps' }, VERIFIER);

    expect(result).toEqual({ token: 'acc', tokenSecret: 'accs' });

    const params = parseOAuthHeader(strategy.calls[0].header);
    expect(params.oauth_token).toBe('tmp');
    expect(params.oauth_verifier).toBe(VERIFIER);

    const normalized = [
      'oauth_consumer_key=ck',
      `oauth_nonce=${NONCE}`,
      'oauth_signature_method=HMAC-SHA1',
      `oauth_timestamp=${TIMESTAMP}`,
      'oauth_token=tmp',
      `oauth_verifier=${VERIFIER}`,
      'oauth_version=1.0',
    ].join('&');
    const baseString = `POST&${percentEncode('https://example.com/oauth/access_token')}&${percentEncode(normalized)}`;
    expect(params.oauth_signature).toBe(hmacSha1(baseString, 'cs&tmps'));
  });

  it('runs the full three-legged flow and returns the final access token', async () => {
    const strategy = new TestAuthorizationStrategy(baseAuth(), [
      'oauth_token=tmp&oauth_token_secret=tmps&oauth_callback_confirmed=true',
      'oauth_token=acc&oauth_token_secret=accs',
    ]);

    const header = await strategy.getAuthHeader({
      method: 'GET',
      url: 'https://api.example.com/resource',
    });

    expect(strategy.calls).toHaveLength(2);
    const params = parseOAuthHeader(header);
    // the actual request must be signed with the acquired access token
    expect(params.oauth_token).toBe('acc');
    const normalized = [
      'oauth_consumer_key=ck',
      `oauth_nonce=${NONCE}`,
      'oauth_signature_method=HMAC-SHA1',
      `oauth_timestamp=${TIMESTAMP}`,
      'oauth_token=acc',
      'oauth_version=1.0',
    ].join('&');
    const baseString = `GET&${percentEncode('https://api.example.com/resource')}&${percentEncode(normalized)}`;
    expect(params.oauth_signature).toBe(hmacSha1(baseString, 'cs&accs'));
  });

  it('throws when the request token endpoint does not confirm the callback', async () => {
    const strategy = new TestAuthorizationStrategy(baseAuth(), [
      'oauth_token=tmp&oauth_token_secret=tmps',
    ]);
    await expect(strategy.runRequestToken()).rejects.toThrow(/callback/i);
  });

  it('throws when the access token endpoint returns no token', async () => {
    const strategy = new TestAuthorizationStrategy(baseAuth(), ['']);
    await expect(
      strategy.runAccessToken({ token: 'tmp', tokenSecret: 'tmps' }, VERIFIER)
    ).rejects.toThrow(/token/i);
  });
});

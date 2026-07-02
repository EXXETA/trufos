import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AuthorizationType,
  OAuth1ExistingTokenAuthorizationInformation,
  OAuth1Method,
  OAuth1SignatureMethod,
} from 'shim/objects';
import ExistingTokenOAuth1Strategy from './existing-token';

const NONCE = 'fixednonce';
const TIMESTAMP = '1234567890';

/** Strategy with deterministic nonce/timestamp for assertions. */
class TestOAuth1AuthStrategy extends ExistingTokenOAuth1Strategy {
  protected generateNonce() {
    return NONCE;
  }
  protected generateTimestamp() {
    return TIMESTAMP;
  }
}

/** Independent RFC 3986 percent-encoder used to cross-check the implementation. */
function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/** Parse an `OAuth a="b", c="d"` header value into a key/value map (decoded). */
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

function baseAuth(
  overrides: Partial<OAuth1ExistingTokenAuthorizationInformation> = {}
): OAuth1ExistingTokenAuthorizationInformation {
  return {
    type: AuthorizationType.OAUTH1,
    method: OAuth1Method.EXISTING_TOKEN,
    consumerKey: 'ck',
    consumerSecret: 'cs',
    signatureMethod: OAuth1SignatureMethod.HMAC_SHA1,
    ...overrides,
  };
}

describe('ExistingTokenOAuth1Strategy', () => {
  it('produces a valid HMAC-SHA1 signature over method, base URL and params', async () => {
    const strategy = new TestOAuth1AuthStrategy(baseAuth());
    const header = await strategy.getAuthHeader({
      method: 'get',
      url: 'http://example.com/path?b=2&a=1',
    });
    const params = parseOAuthHeader(header);

    expect(params.oauth_consumer_key).toBe('ck');
    expect(params.oauth_nonce).toBe(NONCE);
    expect(params.oauth_signature_method).toBe('HMAC-SHA1');
    expect(params.oauth_timestamp).toBe(TIMESTAMP);
    expect(params.oauth_version).toBe('1.0');
    expect(params.oauth_token).toBeUndefined();

    // Independently rebuild the signature base string and verify the signature.
    const normalized = [
      'a=1',
      'b=2',
      'oauth_consumer_key=ck',
      `oauth_nonce=${NONCE}`,
      'oauth_signature_method=HMAC-SHA1',
      `oauth_timestamp=${TIMESTAMP}`,
      'oauth_version=1.0',
    ].join('&');
    const baseString = `GET&${percentEncode('http://example.com/path')}&${percentEncode(normalized)}`;
    const expected = crypto.createHmac('sha1', 'cs&').update(baseString).digest('base64');

    expect(params.oauth_signature).toBe(expected);
  });

  it('includes oauth_token and the token secret in the signing key (three-legged)', async () => {
    const strategy = new TestOAuth1AuthStrategy(baseAuth({ token: 'tok', tokenSecret: 'ts' }));
    const header = await strategy.getAuthHeader({
      method: 'POST',
      url: 'https://example.com/resource',
    });
    const params = parseOAuthHeader(header);

    expect(params.oauth_token).toBe('tok');

    const normalized = [
      'oauth_consumer_key=ck',
      `oauth_nonce=${NONCE}`,
      'oauth_signature_method=HMAC-SHA1',
      `oauth_timestamp=${TIMESTAMP}`,
      'oauth_token=tok',
      'oauth_version=1.0',
    ].join('&');
    const baseString = `POST&${percentEncode('https://example.com/resource')}&${percentEncode(normalized)}`;
    const expected = crypto.createHmac('sha1', 'cs&ts').update(baseString).digest('base64');

    expect(params.oauth_signature).toBe(expected);
  });

  it('supports HMAC-SHA256', async () => {
    const strategy = new TestOAuth1AuthStrategy(
      baseAuth({ signatureMethod: OAuth1SignatureMethod.HMAC_SHA256 })
    );
    const header = await strategy.getAuthHeader({
      method: 'GET',
      url: 'https://example.com/',
    });
    const params = parseOAuthHeader(header);

    expect(params.oauth_signature_method).toBe('HMAC-SHA256');

    const normalized = [
      'oauth_consumer_key=ck',
      `oauth_nonce=${NONCE}`,
      'oauth_signature_method=HMAC-SHA256',
      `oauth_timestamp=${TIMESTAMP}`,
      'oauth_version=1.0',
    ].join('&');
    const baseString = `GET&${percentEncode('https://example.com/')}&${percentEncode(normalized)}`;
    const expected = crypto.createHmac('sha256', 'cs&').update(baseString).digest('base64');

    expect(params.oauth_signature).toBe(expected);
  });

  it('uses the concatenated secrets as the signature for PLAINTEXT', async () => {
    const strategy = new TestOAuth1AuthStrategy(
      baseAuth({ signatureMethod: OAuth1SignatureMethod.PLAINTEXT, tokenSecret: 't&s' })
    );
    const header = await strategy.getAuthHeader({
      method: 'GET',
      url: 'https://example.com/',
    });
    const params = parseOAuthHeader(header);

    expect(params.oauth_signature).toBe(`cs&${percentEncode('t&s')}`);
  });

  it('includes the realm when configured', async () => {
    const strategy = new TestOAuth1AuthStrategy(baseAuth({ realm: 'https://example.com' }));
    const header = await strategy.getAuthHeader({
      method: 'GET',
      url: 'https://example.com/',
    });

    expect(parseOAuthHeader(header).realm).toBe('https://example.com');
  });

  it('throws when no request context is provided', async () => {
    const strategy = new TestOAuth1AuthStrategy(baseAuth());
    await expect(strategy.getAuthHeader()).rejects.toThrow(/method and URL/i);
  });
});

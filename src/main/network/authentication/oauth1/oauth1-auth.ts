import crypto from 'node:crypto';
import { OAuth1AuthorizationInformation, OAuth1SignatureMethod } from 'shim/objects';
import AuthStrategy, { AuthRequestContext } from '../auth-strategy';

/**
 * OAuth 1.0 (RFC 5849) request signing.
 *
 * Builds an `Authorization: OAuth ...` header by signing the request. The
 * signature base string is computed over the HTTP method, the base URL and the
 * normalized request parameters (query parameters plus the protocol `oauth_*`
 * parameters).
 *
 * Limitation: `application/x-www-form-urlencoded` body parameters are not yet
 * included in the signature base string. Requests that carry signed parameters
 * in the body are therefore not fully supported.
 */
export default class OAuth1AuthStrategy extends AuthStrategy<OAuth1AuthorizationInformation> {
  async getAuthHeader(context?: AuthRequestContext): Promise<string> {
    if (context == null) {
      throw new Error('OAuth 1.0 requires the request method and URL to sign the request');
    }

    const url = new URL(context.url);
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.authInfo.consumerKey,
      oauth_nonce: this.generateNonce(),
      oauth_signature_method: this.authInfo.signatureMethod,
      oauth_timestamp: this.generateTimestamp(),
      oauth_version: '1.0',
    };
    if (this.authInfo.token != null && this.authInfo.token !== '') {
      oauthParams.oauth_token = this.authInfo.token;
    }

    const signature = this.sign(context.method, url, oauthParams);
    oauthParams.oauth_signature = signature;

    const headerParams = this.authInfo.realm
      ? { realm: this.authInfo.realm, ...oauthParams }
      : oauthParams;
    const serialized = Object.entries(headerParams)
      .map(
        ([key, value]) =>
          `${OAuth1AuthStrategy.percentEncode(key)}="${OAuth1AuthStrategy.percentEncode(value)}"`
      )
      .join(', ');

    return `OAuth ${serialized}`;
  }

  /** Compute the `oauth_signature` value (not yet percent-encoded for the header). */
  private sign(method: string, url: URL, oauthParams: Record<string, string>): string {
    const signingKey = `${OAuth1AuthStrategy.percentEncode(this.authInfo.consumerSecret)}&${OAuth1AuthStrategy.percentEncode(this.authInfo.tokenSecret ?? '')}`;

    if (this.authInfo.signatureMethod === OAuth1SignatureMethod.PLAINTEXT) {
      return signingKey;
    }

    const baseString = this.buildSignatureBaseString(method, url, oauthParams);
    const algorithm =
      this.authInfo.signatureMethod === OAuth1SignatureMethod.HMAC_SHA256 ? 'sha256' : 'sha1';
    return crypto.createHmac(algorithm, signingKey).update(baseString).digest('base64');
  }

  /** Build the RFC 5849 §3.4.1 signature base string. */
  private buildSignatureBaseString(
    method: string,
    url: URL,
    oauthParams: Record<string, string>
  ): string {
    const params: [string, string][] = [];
    for (const [key, value] of url.searchParams) {
      params.push([key, value]);
    }
    for (const [key, value] of Object.entries(oauthParams)) {
      params.push([key, value]);
    }

    const normalizedParams = params
      .map(([key, value]) => [
        OAuth1AuthStrategy.percentEncode(key),
        OAuth1AuthStrategy.percentEncode(value),
      ])
      // RFC 5849 requires ascending byte ordering, by name then by value.
      .sort(([keyA, valueA], [keyB, valueB]) =>
        keyA < keyB ? -1 : keyA > keyB ? 1 : valueA < valueB ? -1 : valueA > valueB ? 1 : 0
      )
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    return [
      method.toUpperCase(),
      OAuth1AuthStrategy.percentEncode(OAuth1AuthStrategy.baseStringUri(url)),
      OAuth1AuthStrategy.percentEncode(normalizedParams),
    ].join('&');
  }

  /** Scheme + authority + path, lowercased, with default ports and query/fragment stripped. */
  private static baseStringUri(url: URL): string {
    const scheme = url.protocol.replace(/:$/, '').toLowerCase();
    const host = url.hostname.toLowerCase();
    const isDefaultPort =
      url.port === '' ||
      (scheme === 'http' && url.port === '80') ||
      (scheme === 'https' && url.port === '443');
    const authority = isDefaultPort ? host : `${host}:${url.port}`;
    return `${scheme}://${authority}${url.pathname}`;
  }

  /** RFC 3986 percent-encoding (encodes everything except unreserved characters). */
  private static percentEncode(value: string): string {
    return encodeURIComponent(value).replace(
      /[!*'()]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    );
  }

  protected generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  protected generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }
}

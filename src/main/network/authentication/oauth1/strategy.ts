import crypto from 'node:crypto';
import { OAuth1AuthorizationInformation, OAuth1SignatureMethod } from 'shim/objects';
import AuthStrategy, { AuthRequestContext } from '../auth-strategy';

/** The token/secret used to sign the actual request. Both empty means two-legged. */
export interface OAuth1Token {
  token?: string;
  tokenSecret?: string;
}

/**
 * OAuth 1.0 (RFC 5849) request signing.
 *
 * Builds an `Authorization: OAuth ...` header by signing the request. The
 * signature base string is computed over the HTTP method, the base URL and the
 * normalized request parameters (query parameters plus the protocol `oauth_*`
 * parameters).
 *
 * Subclasses provide the access token via {@link resolveToken}: the manual
 * variant returns the configured token, the interactive variant runs the
 * three-legged browser flow.
 *
 * Limitation: `application/x-www-form-urlencoded` body parameters are not yet
 * included in the signature base string. Requests that carry signed parameters
 * in the body are therefore not fully supported.
 */
export default abstract class OAuth1AuthStrategy<
  T extends OAuth1AuthorizationInformation,
> extends AuthStrategy<T> {
  async getAuthHeader(context?: AuthRequestContext): Promise<string> {
    if (context == null) {
      throw new Error('OAuth 1.0 requires the request method and URL to sign the request');
    }

    const { token, tokenSecret } = await this.resolveToken();
    return this.buildOAuthHeader({
      httpMethod: context.method,
      url: new URL(context.url),
      token,
      tokenSecret,
      includeRealm: true,
    });
  }

  /** Obtain the access token/secret used to sign the request. */
  protected abstract resolveToken(): Promise<OAuth1Token>;

  /**
   * Build a signed `OAuth ...` header value.
   * @param httpMethod The HTTP method of the signed request.
   * @param url The request URL (query parameters are included in the signature).
   * @param token The `oauth_token` to include, if any.
   * @param tokenSecret The token secret used in the signing key (empty if none).
   * @param extraParams Extra protocol parameters to sign, e.g. `oauth_callback`
   * or `oauth_verifier`.
   * @param includeRealm Whether to prepend the configured realm to the header.
   */
  protected buildOAuthHeader(opts: {
    httpMethod: string;
    url: URL;
    token?: string;
    tokenSecret?: string;
    extraParams?: Record<string, string>;
    includeRealm?: boolean;
  }): string {
    const { httpMethod, url, token, tokenSecret, extraParams, includeRealm } = opts;

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.authInfo.consumerKey,
      oauth_nonce: this.generateNonce(),
      oauth_signature_method: this.authInfo.signatureMethod,
      oauth_timestamp: this.generateTimestamp(),
      oauth_version: '1.0',
      ...extraParams,
    };
    if (token != null && token !== '') {
      oauthParams.oauth_token = token;
    }

    oauthParams.oauth_signature = this.sign(httpMethod, url, oauthParams, tokenSecret ?? '');

    const headerParams =
      includeRealm && this.authInfo.realm
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
  private sign(
    method: string,
    url: URL,
    oauthParams: Record<string, string>,
    tokenSecret: string
  ): string {
    const signingKey = `${OAuth1AuthStrategy.percentEncode(this.authInfo.consumerSecret)}&${OAuth1AuthStrategy.percentEncode(tokenSecret)}`;

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
  protected static percentEncode(value: string): string {
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

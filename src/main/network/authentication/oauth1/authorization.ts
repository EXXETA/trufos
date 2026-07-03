import Undici from 'undici';
import { OAuth1AuthorizationFlowInformation } from 'shim/objects';
import OAuth1AuthStrategy, { OAuth1Token } from './strategy';
import { openAuthorizationWindow } from '../util/browser-auth';

/** Temporary credentials obtained from the request-token endpoint. */
interface TemporaryCredentials {
  token: string;
  tokenSecret: string;
}

/**
 * Interactive three-legged OAuth 1.0 (RFC 5849 §2): obtains an access token by
 * requesting temporary credentials, letting the user authorize them in a browser
 * window, and exchanging the resulting verifier for an access token. The acquired
 * token is then used to sign the actual request.
 *
 * Like the OAuth2 auth-code flow, this runs on every request (no caching).
 */
export default class AuthorizationOAuth1Strategy extends OAuth1AuthStrategy<OAuth1AuthorizationFlowInformation> {
  protected async resolveToken(): Promise<OAuth1Token> {
    const temporaryCredentials = await this.requestToken();
    const verifier = await this.authorize(temporaryCredentials.token);
    return this.accessToken(temporaryCredentials, verifier);
  }

  /** Step 1: obtain temporary credentials from the request-token endpoint. */
  protected async requestToken(): Promise<TemporaryCredentials> {
    const url = new URL(this.authInfo.requestTokenUrl);
    const header = this.buildOAuthHeader({
      httpMethod: 'POST',
      url,
      tokenSecret: '',
      extraParams: { oauth_callback: this.authInfo.callbackUrl },
    });

    const body = await this.postForm(url, header);
    if (body.get('oauth_callback_confirmed') !== 'true') {
      throw new Error('OAuth 1.0 request-token endpoint did not confirm the callback');
    }
    const token = body.get('oauth_token');
    const tokenSecret = body.get('oauth_token_secret');
    if (token == null || tokenSecret == null) {
      throw new Error('OAuth 1.0 request-token endpoint did not return temporary credentials');
    }
    return { token, tokenSecret };
  }

  /** Step 2: let the user authorize the temporary token and capture the verifier. */
  protected async authorize(requestToken: string): Promise<string> {
    const authorizationUrl = new URL(this.authInfo.authorizationUrl);
    authorizationUrl.searchParams.set('oauth_token', requestToken);

    const redirectUrl = await openAuthorizationWindow(authorizationUrl, this.authInfo.callbackUrl, {
      title: 'OAuth1 Authorization',
    });
    const verifier = redirectUrl?.searchParams.get('oauth_verifier');
    if (verifier == null) {
      throw new Error('OAuth 1.0 authorization did not return a verifier');
    }
    return verifier;
  }

  /** Step 3: exchange the temporary credentials + verifier for an access token. */
  protected async accessToken(
    temporaryCredentials: TemporaryCredentials,
    verifier: string
  ): Promise<OAuth1Token> {
    const url = new URL(this.authInfo.accessTokenUrl);
    const header = this.buildOAuthHeader({
      httpMethod: 'POST',
      url,
      token: temporaryCredentials.token,
      tokenSecret: temporaryCredentials.tokenSecret,
      extraParams: { oauth_verifier: verifier },
    });

    const body = await this.postForm(url, header);
    const token = body.get('oauth_token');
    const tokenSecret = body.get('oauth_token_secret');
    if (token == null || tokenSecret == null) {
      throw new Error('OAuth 1.0 access-token endpoint did not return an access token');
    }
    return { token, tokenSecret };
  }

  /** POST to a token endpoint with the given Authorization header, parsing the form response. */
  protected async postForm(url: URL, authorizationHeader: string): Promise<URLSearchParams> {
    const response = await Undici.fetch(url, {
      method: 'POST',
      headers: { authorization: authorizationHeader },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `OAuth 1.0 token request to ${url.href} failed with status ${response.status}: ${body}`
      );
    }
    return new URLSearchParams(await response.text());
  }
}

import {
  OAuth2AuthorizationInformation,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
} from 'shim/objects';
import AuthStrategy from '../auth-strategy';
import {
  ClientAuth,
  ClientSecretBasic,
  ClientSecretPost,
  Configuration,
  customFetch,
  discovery,
  refreshTokenGrant,
  type TokenEndpointResponse,
} from 'openid-client';
import Undici, { RequestInit } from 'undici';
import { OAuth2TokenCache, type TokenSource } from './token-cache';
import type { CacheKey } from 'main/util/cache';
import { pickValues } from 'main/util/object-util';

export default abstract class OAuth2AuthStrategy<T extends OAuth2AuthorizationInformation>
  extends AuthStrategy<T>
  implements TokenSource
{
  public async getAuthHeader(): Promise<string> {
    const tokens = await OAuth2TokenCache.instance.get(this.getCacheKey(), this);
    return `Bearer ${tokens.access_token}`;
  }

  /** Acquires new tokens from the authorization server. */
  public abstract acquire(): Promise<TokenEndpointResponse>;

  /** Exchanges a refresh token for new tokens. */
  public refresh(refreshToken: string): Promise<TokenEndpointResponse> {
    return refreshTokenGrant(this.getConfiguration(), refreshToken, this.getParameters());
  }

  /**
   * The settings the tokens depend on, in a fixed order. Tokens are reused as long as these stay
   * the same.
   */
  protected getCacheKey(): CacheKey {
    return pickValues(
      this.authInfo,
      'method',
      'issuerUrl',
      'tokenUrl',
      'clientId',
      'clientSecret',
      'scope',
      'clientAuthenticationMethod'
    );
  }

  protected getParameters() {
    const parameters: Record<string, string> = {};
    if (this.authInfo.scope != null && this.authInfo.scope !== '') {
      parameters.scope = this.authInfo.scope;
    }
    return parameters;
  }

  protected getConfiguration() {
    // set client authentication method
    let clientAuth: ClientAuth | undefined;
    switch (this.authInfo.clientAuthenticationMethod) {
      case OAuth2ClientAuthenticationMethod.BASIC_AUTH:
        clientAuth = ClientSecretBasic(this.authInfo.clientSecret);
        break;
      case OAuth2ClientAuthenticationMethod.REQUEST_BODY:
        clientAuth = ClientSecretPost(this.authInfo.clientSecret);
        break;
    }

    // prepare configuration
    const config = new Configuration(
      {
        issuer: this.authInfo.issuerUrl,
        authorization_endpoint:
          'authorizationUrl' in this.authInfo ? this.authInfo.authorizationUrl : undefined,
        token_endpoint: this.authInfo.tokenUrl,
        client_id: this.authInfo.clientId,
      },
      this.authInfo.clientId,
      this.authInfo.clientSecret,
      clientAuth
    );

    config[customFetch] = this.fetch;

    // done
    return config;
  }

  /**
   * Discover the OpenID Connect configuration from the server URL and set the token URL and issuer.
   * @param serverUrl The URL of the OpenID Connect server.
   */
  public async discover(serverUrl: URL) {
    const config = await discovery(serverUrl, this.authInfo.clientId);
    const metadata = config.serverMetadata();
    if (metadata.token_endpoint == null) {
      throw new Error(
        `No token endpoint found in OpenID Connect discovery document at ${serverUrl}`
      );
    }

    if (this.authInfo.method === OAuth2Method.CLIENT_CREDENTIALS) {
      this.authInfo.tokenUrl = metadata.token_endpoint;
    } else {
      this.authInfo.authorizationUrl = metadata.authorization_endpoint ?? '';
    }
  }

  private fetch(url: string, init?: RequestInit) {
    logger.secret.info('OAuth request', {
      url,
      headers: init?.headers,
      body: init?.body,
    });
    return Undici.fetch(url, init);
  }
}

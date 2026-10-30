import { OAuth2AuthorizationInformation, OAuth2ClientAuthenticationMethod } from 'shim/objects';
import AuthStrategy, { type AuthRequestContext } from '../auth-strategy';
import {
  ClientAuth,
  ClientSecretBasic,
  ClientSecretPost,
  Configuration,
  customFetch,
  refreshTokenGrant,
  type TokenEndpointResponse,
} from 'openid-client';
import Undici, { type Dispatcher, RequestInit } from 'undici';
import { OAuth2TokenCache } from './token-cache';
import type { CacheKey } from 'main/util/cache';
import { pickValues } from 'main/util/object-util';

export default abstract class OAuth2AuthStrategy<
  T extends OAuth2AuthorizationInformation,
> extends AuthStrategy<T> {
  public async getAuthHeader({ getDispatcher }: AuthRequestContext): Promise<string> {
    const dispatcher = await getDispatcher();
    const tokens = await OAuth2TokenCache.instance.get(this.getCacheKey(), {
      acquire: () => this.acquire(dispatcher),
      refresh: (refreshToken) => this.refresh(refreshToken, dispatcher),
    });
    return `Bearer ${tokens.access_token}`;
  }

  /**
   * Acquires new tokens from the authorization server.
   * @param dispatcher sends the requests to the authorization server
   */
  protected abstract acquire(dispatcher: Dispatcher): Promise<TokenEndpointResponse>;

  /**
   * Exchanges a refresh token for new tokens.
   * @param refreshToken the refresh token
   * @param dispatcher sends the requests to the authorization server
   */
  protected refresh(refreshToken: string, dispatcher: Dispatcher): Promise<TokenEndpointResponse> {
    return refreshTokenGrant(this.getConfiguration(dispatcher), refreshToken, this.getParameters());
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

  /** @param dispatcher sends the requests to the authorization server */
  protected getConfiguration(dispatcher: Dispatcher) {
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

    config[customFetch] = (url, init) => this.fetch(dispatcher, url, init);

    // done
    return config;
  }

  private fetch(dispatcher: Dispatcher, url: string, init?: RequestInit) {
    logger.secret.info('OAuth request', {
      url,
      headers: init?.headers,
      body: init?.body,
    });
    return Undici.fetch(url, { ...init, dispatcher });
  }
}

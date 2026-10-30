import { OAuth2AuthorizationInformation, OAuth2ClientAuthenticationMethod } from 'shim/objects';
import AuthStrategy, { type AuthRequestContext } from '../auth-strategy';
import {
  ClientAuth,
  ClientError,
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
import { DisplayableError } from 'shim/error/DisplayableError';

export default abstract class OAuth2AuthStrategy<
  T extends OAuth2AuthorizationInformation,
> extends AuthStrategy<T> {
  public async getAuthHeader({ getDispatcher }: AuthRequestContext): Promise<string> {
    const configuration = this.getConfiguration(getDispatcher);
    const tokens = await OAuth2TokenCache.instance
      .get(this.getCacheKey(), {
        acquire: () => this.acquire(configuration),
        refresh: (refreshToken) =>
          refreshTokenGrant(configuration, refreshToken, this.getParameters()),
      })
      .catch((error: unknown) => {
        // openid-client wraps whatever its fetch throws
        throw error instanceof ClientError && error.cause instanceof DisplayableError
          ? error.cause
          : error;
      });
    return `Bearer ${tokens.access_token}`;
  }

  /**
   * Acquires new tokens from the authorization server.
   * @param configuration the configuration to request the tokens with
   */
  protected abstract acquire(configuration: Configuration): Promise<TokenEndpointResponse>;

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

  /**
   * @param getDispatcher returns the dispatcher to send the requests to the authorization server
   * with. It is called for each of them, as a dispatcher can be replaced and closed in the
   * meantime, e.g. during the browser login of an auth code flow.
   */
  private getConfiguration(getDispatcher: AuthRequestContext['getDispatcher']) {
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

    config[customFetch] = async (url, init) => this.fetch(await getDispatcher(), url, init);

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

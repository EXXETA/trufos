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
} from 'openid-client';
import Undici, { RequestInit } from 'undici';

export default abstract class OAuth2AuthStrategy<
  T extends OAuth2AuthorizationInformation,
> extends AuthStrategy<T> {
  public async getAuthHeader() {
    await this.getTokens();
    return `Bearer ${this.authInfo.tokens.access_token}`;
  }

  protected abstract getTokens(): Promise<void>;

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

    // @ts-expect-error type mismatch, but it actually works
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
      this.authInfo.callbackUrl = this.authInfo.callbackUrl;
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

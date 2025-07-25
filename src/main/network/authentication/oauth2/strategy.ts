import {
  OAuth2AuthorizationInformation,
  OAuth2ClientAuthenticationMethod,
} from 'shim/objects/auth/oauth2';
import AuthStrategy from '../auth-strategy';
import {
  ClientAuth,
  ClientSecretBasic,
  ClientSecretPost,
  Configuration,
  discovery,
} from 'openid-client';

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

    // prepare confiugration
    return new Configuration(
      {
        issuer: new URL(this.authInfo.tokenUrl).origin,
        token_endpoint: this.authInfo.tokenUrl,
        client_id: this.authInfo.clientId,
      },
      this.authInfo.clientId,
      this.authInfo.clientSecret,
      clientAuth
    );
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

    this.authInfo.tokenUrl = metadata.token_endpoint;
  }
}

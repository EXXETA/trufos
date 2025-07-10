import { OAuth2AuthorizationInformation } from 'shim/objects/auth/oauth2';
import AuthStrategy from '../auth-strategy';
import { Configuration, customFetch, CustomFetchOptions, discovery } from 'openid-client';

export default abstract class OAuth2AuthStrategy<
  T extends OAuth2AuthorizationInformation,
> extends AuthStrategy<T> {
  public async getAuthHeader() {
    await this.getTokens();
    return `Bearer ${this.authInfo.tokens.access_token}`;
  }

  protected abstract getTokens(): Promise<void>;

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

  protected async fetch(url: string, options: CustomFetchOptions): Promise<Response> {
    console.log('Fetching URL:', url, options);
    return await fetch(url, options as RequestInit);
  }
}

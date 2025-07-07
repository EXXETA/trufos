import { OAuth2ClientCrentialsAuthorizationInformation } from 'shim/objects/auth/oauth2';
import OAuth2AuthStrategy from './strategy';
import { clientCredentialsGrant, discovery } from 'openid-client';

export default class ClientCredentialsAuthorizationStrategy extends OAuth2AuthStrategy<OAuth2ClientCrentialsAuthorizationInformation> {
  protected async getTokens() {
    const config = await discovery(
      new URL(this.authInfo.tokenUrl),
      this.authInfo.clientId,
      this.authInfo.clientSecret
    );

    const parameters: Record<string, string> = {};
    if (this.authInfo.scope != null && this.authInfo.scope !== '') {
      parameters.scope = this.authInfo.scope;
    }
    this.authInfo.tokens = await clientCredentialsGrant(config, parameters);
  }
}

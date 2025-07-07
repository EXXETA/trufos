import { OAuth2ClientCrentialsAuthorizationInformation } from 'shim/objects/auth/oauth2';
import OAuth2AuthStrategy from './strategy';
import { clientCredentialsGrant, discovery } from 'openid-client';

export default class ClientCredentialsAuthorizationStrategy extends OAuth2AuthStrategy<OAuth2ClientCrentialsAuthorizationInformation> {
  protected async getToken() {
    const config = await discovery(
      new URL(this.authInfo.tokenUrl),
      this.authInfo.clientId,
      this.authInfo.clientSecret
    );
    this.authInfo.tokens = await clientCredentialsGrant(config, {
      scope: this.authInfo.scope,
    });
  }
}

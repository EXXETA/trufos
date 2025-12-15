import { OAuth2ClientCrentialsAuthorizationInformation } from 'shim/objects';
import OAuth2AuthStrategy from './strategy';
import { clientCredentialsGrant } from 'openid-client';

export default class ClientCredentialsAuthorizationStrategy extends OAuth2AuthStrategy<OAuth2ClientCrentialsAuthorizationInformation> {
  protected async getTokens() {
    this.authInfo.tokens = await clientCredentialsGrant(
      this.getConfiguration(),
      this.getParameters()
    );
  }
}

import { OAuth2ClientCrentialsAuthorizationInformation } from 'shim/objects/auth/oauth2';
import OAuth2AuthStrategy from './strategy';
import { clientCredentialsGrant } from 'openid-client';

export default class ClientCredentialsAuthorizationStrategy extends OAuth2AuthStrategy<OAuth2ClientCrentialsAuthorizationInformation> {
  protected async getTokens() {
    const parameters: Record<string, string> = {};
    if (this.authInfo.scope != null && this.authInfo.scope !== '') {
      parameters.scope = this.authInfo.scope;
    }
    const { configuration } = this;
    logger.info(configuration.serverMetadata().token_endpoint);
    this.authInfo.tokens = await clientCredentialsGrant(configuration, parameters);
  }
}

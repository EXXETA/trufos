import { OAuth2ClientCrentialsAuthorizationInformation } from 'shim/objects/auth/oauth2';
import OAuth2AuthStrategy from './strategy';
import {
  clientCredentialsGrant,
  ClientSecretBasic,
  Configuration,
  customFetch,
} from 'openid-client';

export default class ClientCredentialsAuthorizationStrategy extends OAuth2AuthStrategy<OAuth2ClientCrentialsAuthorizationInformation> {
  protected async getTokens() {
    const parameters: Record<string, string> = {};
    if (this.authInfo.scope != null && this.authInfo.scope !== '') {
      parameters.scope = this.authInfo.scope;
    }

    const config = new Configuration(
      {
        issuer: new URL(this.authInfo.tokenUrl).origin,
        token_endpoint: this.authInfo.tokenUrl,
        client_id: this.authInfo.clientId,
      },
      this.authInfo.clientId,
      this.authInfo.clientSecret,
      ClientSecretBasic(this.authInfo.clientSecret)
    );
    config[customFetch] = this.fetch;
    this.authInfo.tokens = await clientCredentialsGrant(config, parameters);
  }
}

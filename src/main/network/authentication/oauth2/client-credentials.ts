import {
  OAuth2ClientAuthenticationMethod,
  OAuth2ClientCrentialsAuthorizationInformation,
} from 'shim/objects/auth/oauth2';
import OAuth2AuthStrategy from './strategy';
import {
  ClientAuth,
  clientCredentialsGrant,
  ClientSecretBasic,
  ClientSecretPost,
  Configuration,
  customFetch,
} from 'openid-client';

export default class ClientCredentialsAuthorizationStrategy extends OAuth2AuthStrategy<OAuth2ClientCrentialsAuthorizationInformation> {
  protected async getTokens() {
    const parameters: Record<string, string> = {};
    if (this.authInfo.scope != null && this.authInfo.scope !== '') {
      parameters.scope = this.authInfo.scope;
    }

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
    const config = new Configuration(
      {
        issuer: new URL(this.authInfo.tokenUrl).origin,
        token_endpoint: this.authInfo.tokenUrl,
        client_id: this.authInfo.clientId,
      },
      this.authInfo.clientId,
      this.authInfo.clientSecret,
      clientAuth
    );

    // execute the client credentials grant
    config[customFetch] = this.fetch;
    this.authInfo.tokens = await clientCredentialsGrant(config, parameters);
  }
}

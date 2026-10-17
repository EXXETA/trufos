import { OAuth2ClientCrentialsAuthorizationInformation } from 'shim/objects';
import OAuth2AuthStrategy from './strategy';
import { clientCredentialsGrant, type TokenEndpointResponse } from 'openid-client';

export default class ClientCredentialsAuthorizationStrategy extends OAuth2AuthStrategy<OAuth2ClientCrentialsAuthorizationInformation> {
  public async acquire(): Promise<TokenEndpointResponse> {
    return await clientCredentialsGrant(this.getConfiguration(), this.getParameters());
  }
}

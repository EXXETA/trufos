import { OAuth2ClientCrentialsAuthorizationInformation } from 'shim/objects';
import OAuth2AuthStrategy from './strategy';
import {
  clientCredentialsGrant,
  type Configuration,
  type TokenEndpointResponse,
} from 'openid-client';

export default class ClientCredentialsAuthorizationStrategy extends OAuth2AuthStrategy<OAuth2ClientCrentialsAuthorizationInformation> {
  protected async acquire(configuration: Configuration): Promise<TokenEndpointResponse> {
    return await clientCredentialsGrant(configuration, this.getParameters());
  }
}

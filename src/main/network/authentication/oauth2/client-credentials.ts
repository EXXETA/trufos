import { OAuth2ClientCrentialsAuthorizationInformation } from 'shim/objects';
import OAuth2AuthStrategy from './strategy';
import { clientCredentialsGrant, type TokenEndpointResponse } from 'openid-client';
import type { Dispatcher } from 'undici';

export default class ClientCredentialsAuthorizationStrategy extends OAuth2AuthStrategy<OAuth2ClientCrentialsAuthorizationInformation> {
  protected async acquire(dispatcher: Dispatcher): Promise<TokenEndpointResponse> {
    return await clientCredentialsGrant(this.getConfiguration(dispatcher), this.getParameters());
  }
}

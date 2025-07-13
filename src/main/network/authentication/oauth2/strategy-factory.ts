import { OAuth2AuthorizationInformation, OAuth2Method } from 'shim/objects/auth/oauth2';
import ClientCredentialsAuthorizationStrategy from './client-credentials';

export function createOAuth2Strategy(auth: OAuth2AuthorizationInformation) {
  switch (auth.method) {
    case OAuth2Method.CLIENT_CREDENTIALS:
      return new ClientCredentialsAuthorizationStrategy(auth);
    default:
      throw new Error(`Unsupported OAuth2 method: ${auth.method}`);
  }
}

import { OAuth2AuthorizationInformation, OAuth2Method } from 'shim/objects/auth/oauth2';
import ClientCredentialsAuthorizationStrategy from './client-credentials';
import AuthCodeFlowAuthorizationStrategy from './auth-code-flow';

export function createOAuth2Strategy(auth: OAuth2AuthorizationInformation) {
  switch (auth.method) {
    case OAuth2Method.CLIENT_CREDENTIALS:
      return new ClientCredentialsAuthorizationStrategy(auth);
    case OAuth2Method.AUTHORIZATION_CODE:
      return new AuthCodeFlowAuthorizationStrategy(auth);
    default:
      // @ts-expect-error should never happen
      throw new Error(`Unsupported OAuth2 method: ${auth.method}`);
  }
}

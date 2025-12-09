import { AuthorizationInformation, AuthorizationType } from 'shim/objects';
import BasicAuthStrategy from './basic-auth';
import BearerAuthStrategy from './bearer-auth';
import AuthStrategy from './auth-strategy';
import { createOAuth2Strategy } from './oauth2/strategy-factory';

/**
 * Factory function to create an authentication strategy based on the provided authentication information.
 * @param auth Authentication information containing the type and credentials.
 * @throws Error if the authentication type is unsupported.
 * @returns An instance of the appropriate authentication strategy.
 */
export function createAuthStrategy(
  auth: AuthorizationInformation
): AuthStrategy<AuthorizationInformation> {
  switch (auth.type) {
    case AuthorizationType.BASIC:
      return new BasicAuthStrategy(auth);
    case AuthorizationType.BEARER:
      return new BearerAuthStrategy(auth);
    case AuthorizationType.OAUTH2:
      return createOAuth2Strategy(auth);
    default:
      throw new Error(`Unsupported authentication type: ${auth.type}`);
  }
}

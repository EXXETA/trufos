import { AuthorizationInformation } from 'shim/objects/auth';
import BasicAuthStrategy from './basic-auth';
import BearerAuthStrategy from './bearer-auth';
import AuthStrategy from './auth-strategy';

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
    case 'basic':
      return new BasicAuthStrategy(auth);
    case 'bearer':
      return new BearerAuthStrategy(auth);
    default:
      throw new Error(`Unsupported authentication type: ${auth.type}`);
  }
}

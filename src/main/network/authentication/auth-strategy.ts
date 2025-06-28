import { AuthorizationInformation } from 'shim/objects/auth';

export default abstract class AuthStrategy<T extends AuthorizationInformation> {
  constructor(private readonly authInfo: T) {}

  /**
   * Get the authorization header for the request.
   */
  abstract getAuthHeader(): Promise<string>;
}

import { AuthenticationInformation } from 'shim/objects/auth';

export default abstract class AuthStrategy<T extends AuthenticationInformation> {
  constructor(public readonly authInfo: T) {}

  /**
   * Get the authentication header for the request.
   */
  abstract getAuthHeader(): Promise<string>;
}

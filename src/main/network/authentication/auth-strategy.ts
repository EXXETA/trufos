import { AuthorizationInformation } from 'shim/objects';

export default abstract class AuthStrategy<T extends AuthorizationInformation> {
  constructor(protected readonly authInfo: T) {}

  /**
   * Get the authorization header for the request.
   */
  abstract getAuthHeader(): Promise<string>;
}

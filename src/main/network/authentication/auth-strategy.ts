import { AuthorizationInformation } from 'shim/objects';

/**
 * Context about the outgoing request that some authentication strategies need to
 * compute their header (e.g. OAuth 1.0 request signing). Strategies that don't
 * need it simply ignore the argument.
 */
export interface AuthRequestContext {
  /** The HTTP method of the request, e.g. "GET". */
  method: string;
  /** The fully resolved request URL, including query parameters. */
  url: string;
}

export default abstract class AuthStrategy<T extends AuthorizationInformation> {
  constructor(protected readonly authInfo: T) {}

  /**
   * Get the authorization header for the request.
   * @param context Information about the request being sent. Required by strategies
   * that sign the request (OAuth 1.0); ignored by header-only strategies.
   */
  abstract getAuthHeader(context?: AuthRequestContext): Promise<string>;
}

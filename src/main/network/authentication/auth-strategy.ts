import { AuthorizationInformation } from 'shim/objects';
import { RequestMethod } from 'shim/objects/request-method';
import type { Dispatcher } from 'undici';

/**
 * Context about the outgoing request that some authentication strategies need to
 * compute their header (e.g. OAuth 1.0 request signing, Digest challenges). Strategies
 * that don't need it simply ignore the argument.
 */
export interface AuthRequestContext {
  /** The HTTP method of the request. */
  method: RequestMethod;
  /** The fully resolved request URL, including query parameters. */
  url: string;
  /**
   * Sends the request without its body and returns the values of the `WWW-Authenticate` headers
   * of a 401 response, or an empty array if the server did not ask for authentication. Used by
   * strategies that answer a challenge of the server (Digest).
   */
  getChallenges: () => Promise<string[]>;
  /**
   * Returns the dispatcher the request is sent with, so requests of a strategy to other servers
   * (OAuth 2.0) use the TLS settings and the client certificate of the collection as well.
   */
  getDispatcher: () => Promise<Dispatcher>;
}

export default abstract class AuthStrategy<T extends AuthorizationInformation> {
  constructor(protected readonly authInfo: T) {}

  /**
   * Get the authorization header for the request.
   * @param context Information about the request being sent. Used by strategies that sign
   * the request (OAuth 1.0) or answer a challenge (Digest); ignored by header-only strategies.
   */
  abstract getAuthHeader(context: AuthRequestContext): Promise<string>;
}

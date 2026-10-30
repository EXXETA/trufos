import { RequestMethod } from 'shim/objects/request-method';
import { MockAgent } from 'undici';
import type { AuthRequestContext } from '../auth-strategy';

/** Builds the context of a GET request whose server does not ask for authentication. */
export function makeAuthRequestContext(
  overrides: Partial<AuthRequestContext> = {}
): AuthRequestContext {
  return {
    method: RequestMethod.GET,
    url: 'https://example.com/',
    getChallenges: async () => [],
    getDispatcher: async () => new MockAgent(),
    ...overrides,
  };
}

import { OAuth1AuthorizationInformation, OAuth1Method } from 'shim/objects';
import ExistingTokenOAuth1Strategy from './existing-token';
import AuthorizationOAuth1Strategy from './authorization';

export function createOAuth1Strategy(auth: OAuth1AuthorizationInformation) {
  switch (auth.method) {
    case OAuth1Method.EXISTING_TOKEN:
      return new ExistingTokenOAuth1Strategy(auth);
    case OAuth1Method.AUTHORIZATION:
      return new AuthorizationOAuth1Strategy(auth);
    default:
      // @ts-expect-error should never happen
      throw new Error(`Unsupported OAuth1 method: ${auth.method}`);
  }
}

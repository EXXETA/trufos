import { OAuth1ExistingTokenAuthorizationInformation } from 'shim/objects';
import OAuth1AuthStrategy, { OAuth1Token } from './strategy';

/**
 * Manual / two-legged OAuth 1.0: signs the request with a pre-issued access
 * token and secret (both optional — omitting them yields two-legged,
 * consumer-only signing). No browser interaction.
 */
export default class ExistingTokenOAuth1Strategy extends OAuth1AuthStrategy<OAuth1ExistingTokenAuthorizationInformation> {
  protected async resolveToken(): Promise<OAuth1Token> {
    return { token: this.authInfo.token, tokenSecret: this.authInfo.tokenSecret };
  }
}

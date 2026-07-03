import {
  OAuth2ClientAuthorizationCodeFlowInformation,
  OAuth2ClientAuthorizationCodeFlowPKCEInformation,
  OAuth2Method,
} from 'shim/objects';
import OAuth2AuthStrategy from './strategy';
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  randomPKCECodeVerifier,
  randomState,
} from 'openid-client';
import { openAuthorizationWindow } from '../util/browser-auth';

function isPKCEConfig(
  auth:
    OAuth2ClientAuthorizationCodeFlowInformation | OAuth2ClientAuthorizationCodeFlowPKCEInformation
): auth is OAuth2ClientAuthorizationCodeFlowPKCEInformation {
  return auth.method === OAuth2Method.AUTHORIZATION_CODE_PKCE;
}

export default class AuthCodeFlowAuthorizationStrategy<
  T extends
    OAuth2ClientAuthorizationCodeFlowInformation | OAuth2ClientAuthorizationCodeFlowPKCEInformation,
> extends OAuth2AuthStrategy<T> {
  protected async getTokens() {
    const configuration = this.getConfiguration();
    const parameters = this.getParameters();

    // prepare the authorization URL and state
    parameters.redirect_uri = this.authInfo.callbackUrl;
    parameters.state = this.authInfo.state?.trim() || randomState();

    // if PKCE is used, generate code verifier and challenge
    if (isPKCEConfig(this.authInfo)) {
      this.authInfo.codeVerifier = this.authInfo.codeVerifier?.trim() || randomPKCECodeVerifier();
      parameters.code_challenge = await calculatePKCECodeChallenge(this.authInfo.codeVerifier);
      parameters.code_challenge_method = this.authInfo.codeChallengeMethod;
    }

    // build the authorization URL that is opened in the browser
    const authorizationUrl = buildAuthorizationUrl(configuration, parameters);

    // open browser window to get the authorization code
    const codeUrl = await openAuthorizationWindow(authorizationUrl, parameters.redirect_uri, {
      cache: this.authInfo.cache,
      title: 'OAuth2 Auth Code Flow',
    });
    if (codeUrl == null) {
      throw new Error('Authorization code not received');
    }

    // exchange the authorization code for tokens
    this.authInfo.tokens = await authorizationCodeGrant(configuration, codeUrl, {
      pkceCodeVerifier: 'codeVerifier' in this.authInfo ? this.authInfo.codeVerifier : undefined,
      expectedState: parameters.state,
    });
  }
}

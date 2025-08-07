import {
  OAuth2ClientAuthorizationCodeFlowInformation,
  OAuth2ClientAuthorizationCodeFlowPKCEInformation,
  OAuth2Method,
} from 'shim/objects/auth/oauth2';
import OAuth2AuthStrategy from './strategy';
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  randomPKCECodeVerifier,
  randomState,
} from 'openid-client';
import { BrowserWindow } from 'electron';
import { once } from 'node:events';
import { RequestMethod } from 'shim/objects/request-method';

function isPKCEConfig(
  auth:
    | OAuth2ClientAuthorizationCodeFlowInformation
    | OAuth2ClientAuthorizationCodeFlowPKCEInformation
): auth is OAuth2ClientAuthorizationCodeFlowPKCEInformation {
  return auth.method === OAuth2Method.AUTHORIZATION_CODE_PKCE;
}

export default class AuthCodeFlowAuthorizationStrategy<
  T extends
    | OAuth2ClientAuthorizationCodeFlowInformation
    | OAuth2ClientAuthorizationCodeFlowPKCEInformation,
> extends OAuth2AuthStrategy<T> {
  private async getCurrentUrl(authorizationUrl: URL, callbackUrl: string) {
    let redirectUrl: URL | undefined;

    // create the browser window.
    const window = new BrowserWindow({ titleBarStyle: 'hidden' });
    const { session } = window.webContents;
    if (this.authInfo.cache !== true) {
      session.clearStorageData();
    }

    // intercept the callback URL to get the auth code
    session.webRequest.onBeforeRequest({ urls: [callbackUrl + '?*'] }, (details, callback) => {
      if (details.method.toUpperCase() === RequestMethod.GET) {
        logger.secret.info(`Completed auth code login with redirect URL: ${details.url}`);
        callback({ cancel: true });
        redirectUrl = URL.parse(details.url);
        window.close();
      }
    });

    logger.secret.info(`Opening window with authorization URL: ${authorizationUrl}`);
    window.loadURL(authorizationUrl.toString());
    await once(window, 'close');
    return redirectUrl;
  }

  protected async getTokens() {
    const configuration = this.getConfiguration();
    const parameters = this.getParameters();

    // prepare the authorization URL and state
    parameters.redirect_uri = this.authInfo.callbackUrl;
    parameters.state = this.authInfo.state ?? randomState();

    // if PKCE is used, generate code verifier and challenge
    if (isPKCEConfig(this.authInfo)) {
      this.authInfo.codeVerifier ??= randomPKCECodeVerifier();
      parameters.code_challenge = await calculatePKCECodeChallenge(this.authInfo.codeVerifier);
      parameters.code_challenge_method = this.authInfo.codeChallengeMethod;
    }

    // build the authorization URL that is opened in the browser
    const authorizationUrl = buildAuthorizationUrl(configuration, parameters);

    // open browser window to get the authorization code
    const codeUrl = await this.getCurrentUrl(authorizationUrl, parameters.redirect_uri);
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

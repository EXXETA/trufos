import { OAuth2ClientAuthorizationCodeFlowInformation } from 'shim/objects/auth/oauth2';
import OAuth2AuthStrategy from './strategy';
import { authorizationCodeGrant, buildAuthorizationUrl, randomState } from 'openid-client';
import { BrowserWindow } from 'electron';
import { once } from 'node:events';
import { RequestMethod } from 'shim/objects/request-method';

export default class AuthCodeFlowAuthorizationStrategy extends OAuth2AuthStrategy<OAuth2ClientAuthorizationCodeFlowInformation> {
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
    // prepare the authorization URL and state
    const configuration = this.getConfiguration();
    const parameters = this.getParameters();
    parameters.redirect_uri = this.authInfo.callbackUrl;
    parameters.state = this.authInfo.state ?? randomState();
    const authorizationUrl = buildAuthorizationUrl(configuration, parameters);

    // open browser window to get the authorization code
    const codeUrl = await this.getCurrentUrl(authorizationUrl, parameters.redirect_uri);
    if (codeUrl == null) {
      throw new Error('Authorization code not received');
    }

    // exchange the authorization code for tokens
    this.authInfo.tokens = await authorizationCodeGrant(configuration, codeUrl, {
      expectedState: parameters.state,
    });
  }
}

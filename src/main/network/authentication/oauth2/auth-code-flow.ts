import { OAuth2ClientAuthorizationCodeFlowInformation } from 'shim/objects/auth/oauth2';
import OAuth2AuthStrategy from './strategy';
import { authorizationCodeGrant, buildAuthorizationUrl, randomState } from 'openid-client';
import { BrowserWindow } from 'electron';
import { once } from 'node:events';

export default class AuthCodeFlowAuthorizationStrategy extends OAuth2AuthStrategy<OAuth2ClientAuthorizationCodeFlowInformation> {
  private async getAuthorizationCode(url: URL, callbackUrl: string) {
    let redirectUrl: URL | undefined;

    // Create the browser window.
    const window = new BrowserWindow({
      frame: false,
      titleBarStyle: 'hidden',
    });

    // intercept the callback URL to get the auth code
    window.webContents.session.webRequest.onBeforeRequest(
      { urls: [callbackUrl + '*'] },
      (details, callback) => {
        if (details.method.toUpperCase() === 'GET') {
          logger.info('Completed auth code login');
          callback({ cancel: true });
          redirectUrl = URL.parse(details.url);
          window.close();
        }
      }
    );

    logger.info(`Opening window with authorization URL: ${url}`);
    window.loadURL(url.toString());
    await once(window, 'close');
    return redirectUrl;
  }

  protected async getTokens() {
    // prepare the authorization URL and state
    const configuration = this.getConfiguration();
    const parameters = this.getParameters();
    parameters.redirect_uri = this.authInfo.redirectUri;
    parameters.state = this.authInfo.state ?? randomState();
    const url = buildAuthorizationUrl(configuration, parameters);

    // open browser window to get the authorization code
    const authCode = await this.getAuthorizationCode(url, parameters.redirect_uri);
    if (!authCode) {
      throw new Error('Authorization code not received');
    }

    // exchange the authorization code for tokens
    this.authInfo.tokens = await authorizationCodeGrant(configuration, authCode, {
      expectedState: parameters.state,
    });
  }
}

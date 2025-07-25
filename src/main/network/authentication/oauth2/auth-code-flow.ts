import { OAuth2ClientAuthorizationCodeFlowInformation } from 'shim/objects/auth/oauth2';
import OAuth2AuthStrategy from './strategy';
import { authorizationCodeGrant, buildAuthorizationUrl, randomState } from 'openid-client';
import { BrowserWindow } from 'electron';
import { once } from 'node:events';

export default class AuthCodeFlowAuthorizationStrategy extends OAuth2AuthStrategy<OAuth2ClientAuthorizationCodeFlowInformation> {
  private async getAuthorizationCode(url: URL) {
    // Create the browser window.
    const window = new BrowserWindow({
      frame: false,
      titleBarStyle: 'hidden',
    });

    window.loadURL(url.toString());
    await once(window, 'close');
  }

  protected async getTokens() {
    const configuration = this.getConfiguration();
    const parameters = this.getParameters();
    parameters.redirect_uri = this.authInfo.redirectUri;
    parameters.state = this.authInfo.state ?? randomState();

    const redirectUrl = buildAuthorizationUrl(configuration, parameters);
    logger.info(`Redirecting to authorization URL: ${redirectUrl}`);

    await this.getAuthorizationCode(redirectUrl);

    this.authInfo.tokens = await authorizationCodeGrant(configuration, redirectUrl, {
      expectedState: parameters.state,
    });
  }
}

import { BrowserWindow } from 'electron';
import { once } from 'node:events';
import { RequestMethod } from 'shim/objects/request-method';

/**
 * Open a browser window at the given authorization URL and wait for the user to
 * be redirected to the callback URL. The redirect is intercepted (and cancelled)
 * so the callback is never actually requested; its URL — carrying the auth code
 * (OAuth2) or the `oauth_verifier` (OAuth1) — is returned instead.
 *
 * @param authorizationUrl The URL to load in the browser for the user to log in.
 * @param callbackUrl The redirect URL to intercept.
 * @param options.cache Whether to keep the browser session cache. Defaults to false.
 * @param options.title The window title.
 * @returns The intercepted callback URL, or undefined if the window was closed
 * before a matching redirect occurred.
 */
export async function openAuthorizationWindow(
  authorizationUrl: URL,
  callbackUrl: string,
  options: { cache?: boolean; title?: string } = {}
): Promise<URL | undefined> {
  let redirectUrl: URL | undefined;

  // create the browser window.
  const window = new BrowserWindow({ title: options.title });
  const { session } = window.webContents;
  if (options.cache !== true) {
    session.clearStorageData();
  }

  // intercept the callback URL to get the auth code / verifier
  session.webRequest.onBeforeRequest({ urls: [callbackUrl + '?*'] }, (details, callback) => {
    if (details.method.toUpperCase() === RequestMethod.GET) {
      logger.secret.info(`Completed authorization login with redirect URL: ${details.url}`);
      callback({ cancel: true });
      redirectUrl = URL.parse(details.url) ?? undefined;
      window.close();
    }
  });

  logger.secret.info(`Opening window with authorization URL: ${authorizationUrl}`);
  window.loadURL(authorizationUrl.toString());
  await once(window, 'close');
  return redirectUrl;
}

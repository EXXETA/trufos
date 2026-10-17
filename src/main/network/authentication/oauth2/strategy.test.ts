import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthorizationType,
  OAuth2ClientAuthenticationMethod,
  OAuth2ClientAuthorizationCodeFlowInformation,
  OAuth2ClientCrentialsAuthorizationInformation,
  OAuth2Method,
} from 'shim/objects';
import { createOAuth2Strategy } from './strategy-factory';
import { OAuth2TokenCache } from './token-cache';

const { clientCredentialsGrant, authorizationCodeGrant, openAuthorizationWindow } = vi.hoisted(
  () => ({
    clientCredentialsGrant: vi.fn(),
    authorizationCodeGrant: vi.fn(),
    openAuthorizationWindow: vi.fn(),
  })
);

vi.mock('openid-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('openid-client')>()),
  clientCredentialsGrant,
  authorizationCodeGrant,
}));

vi.mock('../util/browser-auth', () => ({ openAuthorizationWindow }));

const clientCredentials: OAuth2ClientCrentialsAuthorizationInformation = {
  type: AuthorizationType.OAUTH2,
  method: OAuth2Method.CLIENT_CREDENTIALS,
  issuerUrl: 'https://auth.example.com',
  tokenUrl: 'https://auth.example.com/token',
  clientId: 'client',
  clientSecret: 'secret',
  scope: 'read',
  clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
};

const authCode: OAuth2ClientAuthorizationCodeFlowInformation = {
  ...clientCredentials,
  method: OAuth2Method.AUTHORIZATION_CODE,
  authorizationUrl: 'https://auth.example.com/authorize',
  callbackUrl: 'https://app.example.com/callback',
};

describe('OAuth2AuthStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    OAuth2TokenCache.instance.clear();
    clientCredentialsGrant.mockResolvedValue({ access_token: 'token', token_type: 'bearer' });
    authorizationCodeGrant.mockResolvedValue({ access_token: 'token', token_type: 'bearer' });
    openAuthorizationWindow.mockResolvedValue(new URL('https://app.example.com/callback?code=c'));
  });

  it('reuses the tokens of the same configuration for later requests', async () => {
    const first = await createOAuth2Strategy({ ...clientCredentials }).getAuthHeader();
    const second = await createOAuth2Strategy({ ...clientCredentials }).getAuthHeader();

    expect([first, second]).toEqual(['Bearer token', 'Bearer token']);
    expect(clientCredentialsGrant).toHaveBeenCalledOnce();
  });

  it('acquires new tokens once the configuration changed', async () => {
    await createOAuth2Strategy({ ...clientCredentials }).getAuthHeader();
    await createOAuth2Strategy({ ...clientCredentials, scope: 'write' }).getAuthHeader();

    expect(clientCredentialsGrant).toHaveBeenCalledTimes(2);
  });

  it('opens the browser only once for the auth code flow', async () => {
    await createOAuth2Strategy({ ...authCode }).getAuthHeader();
    await createOAuth2Strategy({ ...authCode }).getAuthHeader();

    expect(openAuthorizationWindow).toHaveBeenCalledOnce();
    expect(authorizationCodeGrant).toHaveBeenCalledOnce();
  });
});

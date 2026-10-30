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
import { MockAgent } from 'undici';
import { DisplayableError } from 'shim/error/DisplayableError';
import { makeAuthRequestContext } from '../__mocks__/auth-request-context';

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
    const first = await createOAuth2Strategy({ ...clientCredentials }).getAuthHeader(
      makeAuthRequestContext()
    );
    const second = await createOAuth2Strategy({ ...clientCredentials }).getAuthHeader(
      makeAuthRequestContext()
    );

    expect([first, second]).toEqual(['Bearer token', 'Bearer token']);
    expect(clientCredentialsGrant).toHaveBeenCalledOnce();
  });

  it('acquires new tokens once the configuration changed', async () => {
    await createOAuth2Strategy({ ...clientCredentials }).getAuthHeader(makeAuthRequestContext());
    await createOAuth2Strategy({ ...clientCredentials, scope: 'write' }).getAuthHeader(
      makeAuthRequestContext()
    );

    expect(clientCredentialsGrant).toHaveBeenCalledTimes(2);
  });

  it('opens the browser only once for the auth code flow', async () => {
    await createOAuth2Strategy({ ...authCode }).getAuthHeader(makeAuthRequestContext());
    await createOAuth2Strategy({ ...authCode }).getAuthHeader(makeAuthRequestContext());

    expect(openAuthorizationWindow).toHaveBeenCalledOnce();
    expect(authorizationCodeGrant).toHaveBeenCalledOnce();
  });

  it('does not need the dispatcher for tokens it has already', async () => {
    await createOAuth2Strategy({ ...clientCredentials }).getAuthHeader(makeAuthRequestContext());
    const getDispatcher = vi.fn(async () => new MockAgent());

    await createOAuth2Strategy({ ...clientCredentials }).getAuthHeader(
      makeAuthRequestContext({ getDispatcher })
    );

    expect(getDispatcher).not.toHaveBeenCalled();
  });

  it('does not get the dispatcher before the browser login of the auth code flow', async () => {
    const getDispatcher = vi.fn(async () => new MockAgent());

    await createOAuth2Strategy({ ...authCode }).getAuthHeader(
      makeAuthRequestContext({ getDispatcher })
    );

    expect(openAuthorizationWindow).toHaveBeenCalledOnce();
    expect(getDispatcher).not.toHaveBeenCalled();
  });

  describe('token requests', () => {
    /** @returns a dispatcher that answers one token request for the given grant type */
    const tokenEndpoint = (grantType: string, accessToken: string, expiresIn?: number) => {
      const dispatcher = new MockAgent();
      dispatcher.disableNetConnect();
      dispatcher
        .get('https://auth.example.com')
        .intercept({
          path: '/token',
          method: 'POST',
          body: (body) => new URLSearchParams(body).get('grant_type') === grantType,
        })
        .reply(
          200,
          {
            access_token: accessToken,
            token_type: 'bearer',
            refresh_token: 'refresh',
            expires_in: expiresIn,
          },
          { headers: { 'content-type': 'application/json' } }
        );
      return dispatcher;
    };

    beforeEach(async () => {
      const { clientCredentialsGrant: realGrant } =
        await vi.importActual<typeof import('openid-client')>('openid-client');
      clientCredentialsGrant.mockImplementation(realGrant);
    });

    it('acquires tokens with the dispatcher of the collection', async () => {
      const dispatcher = tokenEndpoint('client_credentials', 'acquired');

      const header = await createOAuth2Strategy({ ...clientCredentials }).getAuthHeader(
        makeAuthRequestContext({ getDispatcher: async () => dispatcher })
      );

      expect(header).toBe('Bearer acquired');
    });

    it('keeps a displayable error of the dispatcher', async () => {
      const error = new DisplayableError('Cannot read the file', 'Client Certificate Not Readable');

      await expect(
        createOAuth2Strategy({ ...clientCredentials }).getAuthHeader(
          makeAuthRequestContext({ getDispatcher: () => Promise.reject(error) })
        )
      ).rejects.toBe(error);
    });

    it('refreshes tokens with the dispatcher of the collection', async () => {
      // the tokens expire within the margin of the cache, so the next request refreshes them
      const acquiring = tokenEndpoint('client_credentials', 'acquired', 1);
      const refreshing = tokenEndpoint('refresh_token', 'refreshed');
      const strategy = createOAuth2Strategy({ ...clientCredentials });

      await strategy.getAuthHeader(
        makeAuthRequestContext({ getDispatcher: async () => acquiring })
      );
      const header = await strategy.getAuthHeader(
        makeAuthRequestContext({ getDispatcher: async () => refreshing })
      );

      expect(header).toBe('Bearer refreshed');
    });
  });
});

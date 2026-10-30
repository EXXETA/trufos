import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthorizationInformation,
  AuthorizationType,
  createDefaultAuthorization,
  OAuth2Method,
} from 'shim/objects/auth';
import type { OAuth2Endpoints } from 'shim/event-service';
import { showError } from '@/error/errorHandler';
import { useOAuth2Discovery } from './useOAuth2Discovery';

const { discoverOAuth2Endpoints } = vi.hoisted(() => ({ discoverOAuth2Endpoints: vi.fn() }));

vi.mock('@/error/errorHandler', () => ({ showError: vi.fn() }));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: { discoverOAuth2Endpoints } },
}));

const ISSUER = 'https://auth.example.com';
const ENDPOINTS: OAuth2Endpoints = {
  tokenUrl: `${ISSUER}/token`,
  authorizationUrl: `${ISSUER}/authorize`,
};
const CLIENT_CREDENTIALS = AuthorizationInformation.parse({
  ...createDefaultAuthorization(AuthorizationType.OAUTH2, OAuth2Method.CLIENT_CREDENTIALS),
  issuerUrl: ISSUER,
});
const AUTH_CODE = AuthorizationInformation.parse({
  ...createDefaultAuthorization(AuthorizationType.OAUTH2, OAuth2Method.AUTHORIZATION_CODE),
  issuerUrl: ISSUER,
});
const OTHER_ISSUER = AuthorizationInformation.parse({ ...AUTH_CODE, issuerUrl: 'https://other' });

/** Starts a discovery that runs until the returned answer is settled. */
async function startDiscovery(auth = AUTH_CODE) {
  const answer = Promise.withResolvers<OAuth2Endpoints>();
  discoverOAuth2Endpoints.mockReturnValueOnce(answer.promise);
  const onDataChanged = vi.fn();
  const hook = renderHook((props) => useOAuth2Discovery(props.auth, props.onDataChanged), {
    initialProps: { auth: auth as AuthorizationInformation | undefined, onDataChanged },
  });
  await act(async () => void hook.result.current.discover());

  const changeAuth = (changed: AuthorizationInformation | undefined) =>
    hook.rerender({ auth: changed, onDataChanged });
  return { ...hook, answer, onDataChanged, changeAuth };
}

describe('useOAuth2Discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not send anything until it is started', () => {
    renderHook(() => useOAuth2Discovery(AUTH_CODE, vi.fn()));

    expect(discoverOAuth2Endpoints).not.toHaveBeenCalled();
  });

  it('does nothing for another authorization type', async () => {
    const { result } = renderHook(() =>
      useOAuth2Discovery({ type: AuthorizationType.BEARER, token: 't' }, vi.fn())
    );

    await act(() => result.current.discover());

    expect(discoverOAuth2Endpoints).not.toHaveBeenCalled();
  });

  it('reports the endpoints of the issuer', async () => {
    const { answer, onDataChanged } = await startDiscovery();

    await act(async () => answer.resolve(ENDPOINTS));

    expect(discoverOAuth2Endpoints).toHaveBeenCalledExactlyOnceWith(ISSUER);
    expect(onDataChanged).toHaveBeenCalledExactlyOnceWith(ENDPOINTS);
  });

  it('is running until the server answered', async () => {
    const { answer, result } = await startDiscovery();
    expect(result.current.isDiscovering).toBe(true);

    await act(async () => answer.resolve(ENDPOINTS));

    expect(result.current.isDiscovering).toBe(false);
  });

  it('shows an error and reports nothing if the discovery fails', async () => {
    const { answer, onDataChanged, result } = await startDiscovery();
    const error = new Error('failed');

    await act(async () => answer.reject(error));

    expect(onDataChanged).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith(expect.any(String), error);
    expect(result.current.isDiscovering).toBe(false);
  });

  it('shows an error if the auth code flow gets no authorization URL', async () => {
    const { answer, onDataChanged } = await startDiscovery();

    await act(async () => answer.resolve({ tokenUrl: ENDPOINTS.tokenUrl }));

    expect(onDataChanged).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledOnce();
  });

  it('does not need an authorization URL for client credentials', async () => {
    const { answer, onDataChanged } = await startDiscovery(CLIENT_CREDENTIALS);

    await act(async () => answer.resolve({ tokenUrl: ENDPOINTS.tokenUrl }));

    expect(onDataChanged).toHaveBeenCalledExactlyOnceWith({ tokenUrl: ENDPOINTS.tokenUrl });
    expect(showError).not.toHaveBeenCalled();
  });

  it('reports to the latest callback', async () => {
    const { answer, onDataChanged, rerender } = await startDiscovery();
    const latestCallback = vi.fn();

    rerender({ auth: AUTH_CODE, onDataChanged: latestCallback });
    await act(async () => answer.resolve(ENDPOINTS));

    expect(onDataChanged).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledExactlyOnceWith(ENDPOINTS);
  });

  describe('once it is obsolete', () => {
    it('can start again right after the issuer changed', async () => {
      const { changeAuth, result } = await startDiscovery();

      changeAuth(OTHER_ISSUER);

      expect(result.current.isDiscovering).toBe(false);
    });

    it('drops the result if the issuer changed', async () => {
      const { answer, changeAuth, onDataChanged } = await startDiscovery();

      changeAuth(OTHER_ISSUER);
      await act(async () => answer.resolve(ENDPOINTS));

      expect(onDataChanged).not.toHaveBeenCalled();
    });

    it('drops the result if the issuer changed and changed back', async () => {
      const { answer, changeAuth, onDataChanged } = await startDiscovery();

      changeAuth(OTHER_ISSUER);
      changeAuth(AUTH_CODE);
      await act(async () => answer.resolve(ENDPOINTS));

      expect(onDataChanged).not.toHaveBeenCalled();
    });

    it('drops the result if the authorization is not OAuth 2.0 anymore', async () => {
      const { answer, changeAuth, onDataChanged } = await startDiscovery();

      changeAuth(undefined);
      await act(async () => answer.resolve(ENDPOINTS));

      expect(onDataChanged).not.toHaveBeenCalled();
    });

    it('drops the result if the editor is gone', async () => {
      const { answer, onDataChanged, unmount } = await startDiscovery();

      unmount();
      await act(async () => answer.resolve(ENDPOINTS));

      expect(onDataChanged).not.toHaveBeenCalled();
    });

    it('shows no error', async () => {
      const { answer, changeAuth } = await startDiscovery();

      changeAuth(OTHER_ISSUER);
      await act(async () => answer.reject(new Error('failed')));

      expect(showError).not.toHaveBeenCalled();
    });
  });
});

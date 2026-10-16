import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthorizationInformation,
  AuthorizationType,
  OAuth2Method,
  OAuth2PKCECodeChallengeMethod,
} from 'shim/objects/auth';
import { AuthorizationTab } from './AuthorizationTab';
import { showError } from '@/error/errorHandler';
import { applyAuthorizationChange } from './authorizationChange';

const { actions, state } = vi.hoisted(() => ({
  actions: { updateRequest: vi.fn() },
  state: { auth: undefined as AuthorizationInformation | undefined },
}));

vi.mock('@/error/errorHandler', () => ({ showError: vi.fn() }));

vi.mock('./authorizationChange', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./authorizationChange')>();
  return { applyAuthorizationChange: vi.fn(actual.applyAuthorizationChange) };
});

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => actions,
  useCollectionStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  selectRequest: (s: typeof state) => ({ auth: s.auth }),
}));

describe('AuthorizationTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the complete authorization when a field changes', () => {
    state.auth = { type: AuthorizationType.BASIC, username: 'user', password: '' };
    render(<AuthorizationTab />);

    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: 'secret' },
    });

    expect(actions.updateRequest).toHaveBeenCalledExactlyOnceWith({
      auth: { type: AuthorizationType.BASIC, username: 'user', password: 'secret' },
    });
  });

  it('shows an error instead of applying an invalid change', () => {
    state.auth = { type: AuthorizationType.BASIC, username: 'user', password: '' };
    const error = new Error('invalid');
    vi.mocked(applyAuthorizationChange).mockImplementationOnce(() => {
      throw error;
    });
    render(<AuthorizationTab />);

    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: 'secret' },
    });

    expect(actions.updateRequest).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith(expect.any(String), error);
  });

  it('shows the default of a field the authorization does not have', () => {
    const { cache: _cache, ...withoutCache } = {
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.AUTHORIZATION_CODE_PKCE,
      issuerUrl: '',
      clientId: '',
      clientSecret: '',
      tokenUrl: '',
      scope: '',
      clientAuthenticationMethod: 'basic-auth',
      authorizationUrl: '',
      callbackUrl: '',
      codeChallengeMethod: OAuth2PKCECodeChallengeMethod.S256,
      codeVerifier: '',
      state: '',
      cache: true,
    } as const;
    state.auth = AuthorizationInformation.parse(withoutCache);
    render(<AuthorizationTab />);

    const checkbox = screen.getByRole('checkbox', { name: 'Keep Browser Session Cache' });
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthorizationInformation,
  AuthorizationType,
  OAuth2Method,
  OAuth2PKCECodeChallengeMethod,
} from 'shim/objects/auth';
import { AuthorizationTab } from './AuthorizationTab';

const { actions, state } = vi.hoisted(() => ({
  actions: { updateRequest: vi.fn() },
  state: {
    collection: { id: 'col', type: 'collection' },
    folders: new Map(),
    request: { auth: undefined as AuthorizationInformation | undefined, parentId: 'col' },
  },
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => actions,
  useCollectionStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  selectRequest: (s: typeof state) => s.request,
}));

describe('AuthorizationTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the complete authorization when a field changes', () => {
    state.request.auth = { type: AuthorizationType.BASIC, username: 'user', password: '' };
    render(<AuthorizationTab />);

    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: 'secret' },
    });

    expect(actions.updateRequest).toHaveBeenCalledExactlyOnceWith({
      auth: { type: AuthorizationType.BASIC, username: 'user', password: 'secret' },
    });
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
    state.request.auth = AuthorizationInformation.parse(withoutCache);
    render(<AuthorizationTab />);

    const checkbox = screen.getByRole('checkbox', { name: 'Keep Browser Session Cache' });
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
  });
});

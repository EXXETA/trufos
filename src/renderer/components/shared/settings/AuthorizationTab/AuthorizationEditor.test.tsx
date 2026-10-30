import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthorizationInformation,
  AuthorizationInformationNoInherit,
  AuthorizationType,
  createDefaultAuthorization,
  OAuth2Method,
} from 'shim/objects/auth';
import { FolderInfo } from 'shim/collection-model';
import { showError } from '@/error/errorHandler';
import { AuthorizationEditor } from './AuthorizationEditor';
import { applyAuthorizationChange } from './authorizationChange';
import type { FormProps } from './ModularForm';

const { state, form, discoverOAuth2Endpoints } = vi.hoisted(() => ({
  discoverOAuth2Endpoints: vi.fn(),
  state: {
    collection: {
      id: 'col',
      type: 'collection',
      auth: undefined as AuthorizationInformationNoInherit | undefined,
    },
    folders: new Map<string, FolderInfo>(),
  },
  form: { props: undefined as FormProps | undefined },
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('@/error/errorHandler', () => ({ showError: vi.fn() }));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: { discoverOAuth2Endpoints } },
}));

vi.mock('./authorizationChange', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./authorizationChange')>();
  return { applyAuthorizationChange: vi.fn(actual.applyAuthorizationChange) };
});

vi.mock('./ModularForm', () => ({
  ModularForm: (props: FormProps) => {
    form.props = props;
    const description = props.config.description;
    return <p>{description?.type === 'label' ? description.text : ''}</p>;
  },
}));

const BEARER = { type: AuthorizationType.BEARER, token: 't' } as const;
const INHERIT = { type: AuthorizationType.INHERIT } as const;

describe('AuthorizationEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.collection.auth = undefined;
    state.folders = new Map();
  });

  it('reports the complete changed authorization', () => {
    const onAuthChange = vi.fn();
    render(<AuthorizationEditor level="collection" auth={BEARER} onAuthChange={onAuthChange} />);

    form.props?.onDataChanged({ token: 'changed' });

    expect(onAuthChange).toHaveBeenCalledExactlyOnceWith({ ...BEARER, token: 'changed' });
  });

  it('shows an error instead of reporting an invalid change', () => {
    const onAuthChange = vi.fn();
    const error = new Error('invalid');
    vi.mocked(applyAuthorizationChange).mockImplementationOnce(() => {
      throw error;
    });
    render(<AuthorizationEditor level="collection" auth={BEARER} onAuthChange={onAuthChange} />);

    form.props?.onDataChanged({ token: 'changed' });

    expect(onAuthChange).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith(expect.any(String), error);
  });

  describe('OAuth2 discovery', () => {
    const ISSUER = 'https://auth.example.com';
    const CLIENT_CREDENTIALS = AuthorizationInformation.parse({
      ...createDefaultAuthorization(AuthorizationType.OAUTH2, OAuth2Method.CLIENT_CREDENTIALS),
      issuerUrl: ISSUER,
    });
    const AUTH_CODE = AuthorizationInformation.parse({
      ...createDefaultAuthorization(AuthorizationType.OAUTH2, OAuth2Method.AUTHORIZATION_CODE),
      issuerUrl: ISSUER,
    });
    const ENDPOINTS = {
      tokenUrl: `${ISSUER}/token`,
      authorizationUrl: `${ISSUER}/authorize`,
    };

    const clickDiscover = async () => {
      await act(async () => form.props?.fieldActions?.issuerUrl.onClick());
    };

    it('fills in both URLs for the auth code flow', async () => {
      const onAuthChange = vi.fn();
      discoverOAuth2Endpoints.mockResolvedValue(ENDPOINTS);
      render(
        <AuthorizationEditor level="collection" auth={AUTH_CODE} onAuthChange={onAuthChange} />
      );

      await clickDiscover();

      expect(onAuthChange).toHaveBeenCalledExactlyOnceWith(expect.objectContaining(ENDPOINTS));
    });

    it('fills in only the token URL for client credentials', async () => {
      const onAuthChange = vi.fn();
      discoverOAuth2Endpoints.mockResolvedValue(ENDPOINTS);
      render(
        <AuthorizationEditor
          level="collection"
          auth={CLIENT_CREDENTIALS}
          onAuthChange={onAuthChange}
        />
      );

      await clickDiscover();

      expect(onAuthChange).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ tokenUrl: ENDPOINTS.tokenUrl })
      );
      expect(onAuthChange.mock.calls[0][0]).not.toHaveProperty('authorizationUrl');
    });

    it('keeps changes made while the server answers', async () => {
      const onAuthChange = vi.fn();
      const answer = Promise.withResolvers<typeof ENDPOINTS>();
      discoverOAuth2Endpoints.mockReturnValue(answer.promise);
      const { rerender } = render(
        <AuthorizationEditor level="collection" auth={AUTH_CODE} onAuthChange={onAuthChange} />
      );

      await clickDiscover();
      const edited = AuthorizationInformation.parse({ ...AUTH_CODE, scope: 'edited' });
      rerender(
        <AuthorizationEditor level="collection" auth={edited} onAuthChange={onAuthChange} />
      );
      await act(async () => answer.resolve(ENDPOINTS));

      expect(onAuthChange).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ ...ENDPOINTS, scope: 'edited' })
      );
    });
  });

  it('names the folder the authorization is inherited from', () => {
    state.folders.set('f1', {
      id: 'f1',
      parentId: 'col',
      type: 'folder',
      lastModified: 0,
      title: 'Admin',
      auth: BEARER,
    });

    render(
      <AuthorizationEditor level="request" parentId="f1" auth={INHERIT} onAuthChange={vi.fn()} />
    );

    expect(screen.getByText('Bearer Token is inherited from the folder "Admin".')).toBeTruthy();
  });

  it('names the collection the authorization is inherited from', () => {
    state.collection.auth = BEARER;

    render(
      <AuthorizationEditor level="folder" parentId="col" auth={INHERIT} onAuthChange={vi.fn()} />
    );

    expect(screen.getByText('Bearer Token is inherited from the collection.')).toBeTruthy();
  });

  it('tells when there is nothing to inherit', () => {
    render(
      <AuthorizationEditor level="folder" parentId="col" auth={INHERIT} onAuthChange={vi.fn()} />
    );

    expect(screen.getByText(/^Nothing is inherited/)).toBeTruthy();
  });
});

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationInformationNoInherit, AuthorizationType } from 'shim/objects/auth';
import { FolderInfo } from 'shim/collection-model';
import { showError } from '@/error/errorHandler';
import { AuthorizationEditor } from './AuthorizationEditor';
import { applyAuthorizationChange } from './authorizationChange';
import type { FormProps } from './ModularForm';

const { state, form } = vi.hoisted(() => ({
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

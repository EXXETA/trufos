import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationInformation, AuthorizationType } from 'shim/objects/auth';
import { FolderInfo } from 'shim/collection-model';
import type { AuthorizationEditorProps } from '@/components/shared/settings/AuthorizationTab/AuthorizationEditor';
import { FolderSettingsModal } from './FolderSettingsModal';

const { actions, state, editor } = vi.hoisted(() => ({
  actions: { updateFolder: vi.fn(async () => true) },
  state: { folders: new Map<string, FolderInfo>() },
  editor: { props: undefined as AuthorizationEditorProps | undefined },
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => actions,
  useCollectionStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  selectFolder: (s: typeof state, id: string) => s.folders.get(id),
}));

vi.mock('@/components/shared/settings/AuthorizationTab/AuthorizationEditor', () => ({
  AuthorizationEditor: (props: AuthorizationEditorProps) => {
    editor.props = props;
    return (
      <>
        <button onClick={() => props.onAuthChange({ type: AuthorizationType.INHERIT })}>
          Inherit
        </button>
        <button onClick={() => props.onAuthChange({ type: AuthorizationType.BEARER, token: 't' })}>
          Bearer
        </button>
      </>
    );
  },
}));

const BEARER: AuthorizationInformation = { type: AuthorizationType.BEARER, token: 't' };

function setFolder(auth?: FolderInfo['auth']) {
  const folder: FolderInfo = {
    id: 'f1',
    parentId: 'col',
    type: 'folder',
    lastModified: 0,
    title: 'Folder',
  };
  state.folders = new Map([['f1', auth == null ? folder : { ...folder, auth }]]);
}

describe('FolderSettingsModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setFolder({ type: AuthorizationType.BEARER, token: 't' });
  });

  it('is closed without a folder', () => {
    render(<FolderSettingsModal onClose={onClose} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a folder without an authorization as inheriting', () => {
    setFolder();
    render(<FolderSettingsModal folderId="f1" onClose={onClose} />);

    expect(editor.props).toMatchObject({
      level: 'folder',
      parentId: 'col',
      auth: { type: AuthorizationType.INHERIT },
    });
  });

  it('disables Save when nothing has changed', () => {
    render(<FolderSettingsModal folderId="f1" onClose={onClose} />);

    const save = screen.getByRole('button', { name: /^save$/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it('removes the authorization when the folder inherits it again', async () => {
    const user = userEvent.setup();
    render(<FolderSettingsModal folderId="f1" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Inherit' }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(actions.updateFolder).toHaveBeenCalledExactlyOnceWith('f1', { auth: null });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('saves the authorization of a folder that inherited it', async () => {
    const user = userEvent.setup();
    setFolder();
    render(<FolderSettingsModal folderId="f1" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Bearer' }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(actions.updateFolder).toHaveBeenCalledExactlyOnceWith('f1', { auth: BEARER });
  });

  it('stays open if saving failed', async () => {
    const user = userEvent.setup();
    actions.updateFolder.mockResolvedValueOnce(false);
    render(<FolderSettingsModal folderId="f1" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Inherit' }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onClose).not.toHaveBeenCalled();
  });
});

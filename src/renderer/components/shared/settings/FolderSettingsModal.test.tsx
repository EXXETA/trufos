import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationInformation, AuthorizationType } from 'shim/objects/auth';
import { FolderInfo, InheritedHeader } from 'shim/collection-model';
import { makeInheritedHeader } from 'shim/__mocks__/collection-fixtures';
import type { AuthorizationEditorProps } from '@/components/shared/settings/AuthorizationTab/AuthorizationEditor';
import { FolderSettingsModal } from './FolderSettingsModal';

const { actions, state, editor, inheritedOf } = vi.hoisted(() => ({
  actions: { updateFolder: vi.fn(async () => true) },
  state: { folders: new Map<string, FolderInfo>() },
  editor: { props: undefined as AuthorizationEditorProps | undefined },
  inheritedOf: vi.fn((): InheritedHeader[] => []),
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => actions,
  useCollectionStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  selectFolder: (s: typeof state, id: string) => s.folders.get(id),
  useInheritedHeaders: inheritedOf,
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
    inheritedOf.mockReturnValue([makeInheritedHeader('X-Tenant', 'acme')]);
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

  it('saves the headers of a folder and shows the ones it inherits', async () => {
    const user = userEvent.setup();
    render(<FolderSettingsModal folderId="f1" onClose={onClose} />);

    await user.click(screen.getByRole('tab', { name: 'Headers' }));
    expect(screen.getByText('X-Tenant')).toBeTruthy();
    // folders cannot disable inherited headers
    expect(screen.queryByRole('checkbox', { name: /inherited/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: /add header/i }));
    await user.type(screen.getByRole('textbox', { name: 'Header key' }), 'X-Folder');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    // the inherited headers are marked as overridden by the unsaved headers of the folder
    expect(inheritedOf).toHaveBeenLastCalledWith({
      parentId: 'col',
      headers: [{ key: 'X-Folder', value: '', isActive: true }],
    });
    expect(actions.updateFolder).toHaveBeenCalledExactlyOnceWith('f1', {
      headers: [{ key: 'X-Folder', value: '', isActive: true }],
    });
  });

  it('removes the headers of a folder when all are deleted', async () => {
    const user = userEvent.setup();
    state.folders.set('f1', {
      ...state.folders.get('f1')!,
      headers: [{ key: 'X-Folder', value: 'f', isActive: true }],
    });
    render(<FolderSettingsModal folderId="f1" onClose={onClose} />);

    await user.click(screen.getByRole('tab', { name: 'Headers' }));
    await user.click(screen.getByRole('button', { name: /delete selected/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(actions.updateFolder).toHaveBeenCalledExactlyOnceWith('f1', { headers: null });
  });
});

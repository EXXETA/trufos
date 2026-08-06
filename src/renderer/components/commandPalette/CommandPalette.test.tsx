import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CommandPalette } from './CommandPalette';
import { RequestMethod } from 'shim/objects/request-method';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { Folder } from 'shim/objects/folder';

const setSelectedRequestMock = vi.fn();
const addNewRequestMock = vi.fn();
const discardChangesMock = vi.fn();
const sendRequestMock = vi.fn();
const saveRequestMock = vi.fn();

const makeRequest = (id: string, parentId: string, title: string, method: RequestMethod) =>
  ({
    id,
    parentId,
    type: 'request',
    title,
    lastModified: 0,
    url: { base: 'http://localhost', query: [] },
    method,
    headers: [],
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    draft: false,
  }) as unknown as TrufosRequest;

const makeFolder = (id: string, title: string, children: TrufosRequest[]) =>
  ({
    id,
    parentId: 'col-1',
    type: 'folder',
    title,
    lastModified: 0,
    children,
  }) as unknown as Folder;

// Mutable so each describe block can install its own fixture — CommandPalette now reads both
// `collection` and `folders` from the store.
let mockCollection: unknown;
let mockFolders: Map<string, Folder>;
// Mutable so tests can toggle presence/`draft` state for the hotkey-guard assertions below — was
// a hardcoded `() => undefined` before.
let mockCurrentRequest: TrufosRequest | undefined;

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: <T,>(selector: (state: unknown) => T) =>
    selector({ collection: mockCollection, folders: mockFolders, selectedRequestId: undefined }),
  useCollectionActions: () => ({
    setSelectedRequest: setSelectedRequestMock,
    addNewRequest: addNewRequestMock,
    updateRequest: vi.fn(),
    discardChanges: discardChangesMock,
    addNewFolder: vi.fn(),
  }),
  selectRequest: () => mockCurrentRequest,
}));

vi.mock('@/state/environmentStore', () => ({
  useEnvironmentStore: <T,>(selector: (state: unknown) => T) =>
    selector({ environments: {}, selectedEnvironment: undefined }),
  useEnvironmentActions: () => ({ selectEnvironment: vi.fn() }),
  selectEnvironments: (state: { environments: unknown }) => state.environments,
  selectSelectedEnvironment: (state: { selectedEnvironment: unknown }) => state.selectedEnvironment,
}));

vi.mock('@/state/responseStore', () => ({
  useResponseActions: () => ({ addResponse: vi.fn() }),
}));

vi.mock('@/state/viewStore', () => ({
  useViewActions: () => ({ openCollectionSettings: vi.fn(), openAppSettings: vi.fn() }),
}));

// Real @/hooks/hotKeys/useHotkey is used (not mocked) so tests exercise the actual window
// keydown/capture/enabled wiring — only the request-side-effect hooks are stubbed here.
vi.mock('@/hooks/request/useRequestActions', () => ({
  useSendRequest: () => ({ sendRequest: sendRequestMock, isSending: false }),
  useSaveRequest: () => ({ saveRequest: saveRequestMock, isSaving: false }),
}));

describe('CommandPalette nested request title collision (cmdk value fix)', () => {
  // Two requests in different folders share the title "Get" but have different methods —
  // this is the collision that reproduces the cmdk keyboard-selection mismatch.
  const requestUsersGet = makeRequest('req-users-get', 'folder-users', 'Get', RequestMethod.GET);
  const requestPostsGet = makeRequest('req-posts-get', 'folder-posts', 'Get', RequestMethod.DELETE);
  const folderUsers = makeFolder('folder-users', 'Users', [requestUsersGet]);
  const folderPosts = makeFolder('folder-posts', 'Posts', [requestPostsGet]);

  beforeEach(() => {
    setSelectedRequestMock.mockClear();
    mockCollection = {
      id: 'col-1',
      title: 'Test Collection',
      type: 'collection',
      children: [folderUsers, folderPosts],
    };
    mockFolders = new Map([
      ['folder-users', folderUsers],
      ['folder-posts', folderPosts],
    ]);
  });

  it('selects the correct request when navigating to a nested request whose title collides with another', async () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /requests/i }));

    // Two rows render, both titled "Get" — one under Users (GET), one under Posts (DELETE).
    const rows = screen.getAllByRole('option');
    expect(rows).toHaveLength(2);

    const input = screen.getByPlaceholderText('Search...');
    // cmdk selects the first item by default; move the highlight to the second "Get" row,
    // then confirm with Enter — this is the exact sequence that misfired pre-fix.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(setSelectedRequestMock).toHaveBeenCalledWith(requestPostsGet.id);
  });

  it('still matches nested requests by title when searching, despite the value now being the id', async () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /requests/i }));
    await user.type(screen.getByPlaceholderText('Search...'), 'Get');

    expect(screen.queryByText('No requests found.')).toBeNull();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});

describe('CommandPalette nested folder state staleness (folders Map fix)', () => {
  // Simulates the exact post-`updateRequest` divergence confirmed via a real Immer test:
  // `collection.children`'s embedded tree still holds the OLD child (immer never touches
  // `state.collection` when a mutation only goes through `state.folders.get(parentId)`), while
  // the separate `folders` Map holds the NEW, correctly-updated child. A restart resyncs both
  // from the same source, which is why this only reproduces mid-session.
  const staleExport = makeRequest('req-export', 'folder-reports', 'Export', RequestMethod.GET);
  const freshExport = makeRequest('req-export', 'folder-reports', 'Export', RequestMethod.DELETE);
  const staleFolderInTree = makeFolder('folder-reports', 'Reports', [staleExport]);
  const freshFolderInMap = makeFolder('folder-reports', 'Reports', [freshExport]);

  beforeEach(() => {
    setSelectedRequestMock.mockClear();
    mockCollection = {
      id: 'col-1',
      title: 'Test Collection',
      type: 'collection',
      children: [staleFolderInTree],
    };
    mockFolders = new Map([['folder-reports', freshFolderInMap]]);
  });

  it('shows the fresh method from the folders Map, not the stale embedded tree', async () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /requests/i }));

    expect(screen.getByText('DELETE')).toBeDefined();
    expect(screen.queryByText('GET')).toBeNull();
  });
});

describe('CommandPalette owns Send/Save/New-request hotkeys while open', () => {
  const dispatchKeyDown = (init: KeyboardEventInit) =>
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

  beforeEach(() => {
    setSelectedRequestMock.mockClear();
    addNewRequestMock.mockClear();
    discardChangesMock.mockClear();
    sendRequestMock.mockClear().mockResolvedValue(undefined);
    saveRequestMock.mockClear().mockResolvedValue(undefined);
    mockCollection = { id: 'col-1', title: 'Test Collection', type: 'collection', children: [] };
    mockFolders = new Map();
    mockCurrentRequest = undefined;
  });

  it('mod+enter sends the current request and closes the palette', async () => {
    mockCurrentRequest = makeRequest('req-1', 'col-1', 'Req', RequestMethod.GET);
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    dispatchKeyDown({ key: 'Enter', metaKey: true });

    await waitFor(() => expect(sendRequestMock).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('mod+enter does nothing when there is no current request', () => {
    mockCurrentRequest = undefined;
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    dispatchKeyDown({ key: 'Enter', metaKey: true });

    expect(sendRequestMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('mod+s saves the current request and closes the palette when there is a draft', async () => {
    mockCurrentRequest = { ...makeRequest('req-1', 'col-1', 'Req', RequestMethod.GET), draft: true };
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    dispatchKeyDown({ key: 's', metaKey: true });

    await waitFor(() => expect(saveRequestMock).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('mod+s does nothing when there is no draft to save', () => {
    mockCurrentRequest = { ...makeRequest('req-1', 'col-1', 'Req', RequestMethod.GET), draft: false };
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    dispatchKeyDown({ key: 's', metaKey: true });

    expect(saveRequestMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('mod+n creates a new request and closes the palette', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    dispatchKeyDown({ key: 'n', metaKey: true });

    expect(addNewRequestMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('does not own its hotkeys while closed, so nothing fires', () => {
    mockCurrentRequest = { ...makeRequest('req-1', 'col-1', 'Req', RequestMethod.GET), draft: true };
    const onClose = vi.fn();
    render(<CommandPalette open={false} onClose={onClose} />);

    dispatchKeyDown({ key: 'Enter', metaKey: true });
    dispatchKeyDown({ key: 's', metaKey: true });
    dispatchKeyDown({ key: 'n', metaKey: true });

    expect(sendRequestMock).not.toHaveBeenCalled();
    expect(saveRequestMock).not.toHaveBeenCalled();
    expect(addNewRequestMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('CommandPalette tab-strip cycling via keyboard', () => {
  // Wrapped in act() (unlike the raw window.dispatchEvent used elsewhere in this file) because
  // these assertions read the re-rendered DOM (which tab is active), not just whether a mock was
  // called — a native (non-React-synthetic) event handler's setState needs an explicit act() flush
  // before the DOM reflects it in a synchronous assertion.
  const dispatchKeyDown = (init: KeyboardEventInit) =>
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
    });

  const activeTabName = () => screen.getByRole('tab', { selected: true }).textContent ?? '';

  beforeEach(() => {
    mockCollection = { id: 'col-1', title: 'Test Collection', type: 'collection', children: [] };
    mockFolders = new Map();
    mockCurrentRequest = undefined;
  });

  it('Tab and ArrowRight cycle forward through All -> Requests -> Environments -> Actions and wrap', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);

    expect(activeTabName()).toMatch(/all/i);

    dispatchKeyDown({ key: 'Tab' });
    expect(activeTabName()).toMatch(/requests/i);

    dispatchKeyDown({ key: 'ArrowRight' });
    expect(activeTabName()).toMatch(/environments/i);

    dispatchKeyDown({ key: 'Tab' });
    expect(activeTabName()).toMatch(/actions/i);

    dispatchKeyDown({ key: 'ArrowRight' });
    expect(activeTabName()).toMatch(/all/i); // wraps back to the first tab
  });

  it('Shift+Tab and ArrowLeft cycle backward and wrap at the start', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);

    expect(activeTabName()).toMatch(/all/i);

    dispatchKeyDown({ key: 'Tab', shiftKey: true });
    expect(activeTabName()).toMatch(/actions/i); // wraps back to the last tab

    dispatchKeyDown({ key: 'ArrowLeft' });
    expect(activeTabName()).toMatch(/environments/i);
  });

  it('plain Tab does not also trigger the Shift+Tab handler, and vice versa', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);

    dispatchKeyDown({ key: 'Tab', shiftKey: true });
    expect(activeTabName()).toMatch(/actions/i); // backward from 'all' wraps to 'actions'

    dispatchKeyDown({ key: 'Tab' });
    expect(activeTabName()).toMatch(/all/i); // forward from 'actions' wraps to 'all'
  });

  it('does not cycle tabs while closed', () => {
    render(<CommandPalette open={false} onClose={vi.fn()} />);

    dispatchKeyDown({ key: 'Tab' });
    dispatchKeyDown({ key: 'ArrowRight' });

    expect(screen.queryByRole('tab')).toBeNull();
  });
});

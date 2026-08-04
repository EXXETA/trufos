import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CommandPalette } from './CommandPalette';
import { RequestMethod } from 'shim/objects/request-method';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { Folder } from 'shim/objects/folder';

const setSelectedRequestMock = vi.fn();

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
// `collection` and `folders` from the store (see Task 13's follow-up fix).
let mockCollection: unknown;
let mockFolders: Map<string, Folder>;

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: <T,>(selector: (state: unknown) => T) =>
    selector({ collection: mockCollection, folders: mockFolders, selectedRequestId: undefined }),
  useCollectionActions: () => ({
    setSelectedRequest: setSelectedRequestMock,
    addNewRequest: vi.fn(),
    updateRequest: vi.fn(),
    discardChanges: vi.fn(),
    addNewFolder: vi.fn(),
  }),
  selectRequest: () => undefined,
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

describe('CommandPalette nested request title collision (Task 13, cmdk value fix)', () => {
  // Two requests in different folders share the title "Get" but have different methods —
  // this is the collision that reproduces the cmdk keyboard-selection mismatch.
  const requestUsersGet = makeRequest('req-users-get', 'folder-users', 'Get', RequestMethod.GET);
  const requestPostsGet = makeRequest(
    'req-posts-get',
    'folder-posts',
    'Get',
    RequestMethod.DELETE
  );
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

describe('CommandPalette nested folder state staleness (Task 13, folders Map fix)', () => {
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

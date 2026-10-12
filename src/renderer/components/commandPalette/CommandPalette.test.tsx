import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CommandPalette } from './CommandPalette';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosRequest } from 'shim/objects/request';
import { CollectionModel, normalizeCollection } from 'shim/collection-model';
import { Folder } from 'shim/objects/folder';
import {
  makeCollection,
  makeFolder as makeTestFolder,
  makeRequest as makeTestRequest,
} from '@/__mocks__/fake-collection-main';

const setSelectedRequestMock = vi.fn();
const discardChangesMock = vi.fn();
const selectEnvironmentMock = vi.fn().mockResolvedValue(undefined);
const sendRequestMock = vi.fn();
const saveRequestMock = vi.fn();
const requestCreateItemMock = vi.fn();

const makeRequest = (id: string, parentId: string, title: string, method: RequestMethod) =>
  makeTestRequest(id, parentId, { title, method });

const makeFolder = (id: string, title: string, children: TrufosRequest[]): Folder => ({
  ...makeTestFolder(id, 'col-1', children),
  title,
});

/** Builds the collection store state for a collection with the given children. */
const makeModel = (children: (Folder | TrufosRequest)[] = []): CollectionModel =>
  normalizeCollection(makeCollection('col-1', children, { title: 'Test Collection' }));

// Mutable so each describe block can install its own fixture.
let mockModel: CollectionModel;
// Mutable so tests can toggle presence/`draft` state for the hotkey-guard assertions below.
let mockCurrentRequest: TrufosRequest | undefined;

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: <T,>(selector: (state: unknown) => T) =>
    selector({ ...mockModel, selectedRequestId: undefined }),
  useCollectionActions: () => ({
    setSelectedRequest: setSelectedRequestMock,
    updateRequest: vi.fn(),
    discardChanges: discardChangesMock,
    selectEnvironment: selectEnvironmentMock,
    addNewFolder: vi.fn(),
  }),
  selectRequest: () => mockCurrentRequest,
}));

vi.mock('@/state/responseStore', () => ({
  useResponseActions: () => ({ addResponse: vi.fn() }),
}));

vi.mock('@/state/viewStore', () => ({
  useViewActions: () => ({
    openCollectionSettings: vi.fn(),
    openAppSettings: vi.fn(),
    requestCreateItem: requestCreateItemMock,
  }),
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
    mockModel = makeModel([folderUsers, folderPosts]);
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

describe('CommandPalette request state', () => {
  // The palette reads nested requests from the `requests` Map via `childIds`, so it shows a
  // request's current (e.g. edited) state.
  beforeEach(() => {
    setSelectedRequestMock.mockClear();
    const model = makeModel([
      makeFolder('folder-reports', 'Reports', [
        makeRequest('req-export', 'folder-reports', 'Export', RequestMethod.GET),
      ]),
    ]);
    const edited = { ...model.requests.get('req-export')!, method: RequestMethod.DELETE };
    model.requests.set('req-export', edited);
    mockModel = model;
  });

  it('shows the current method of a nested request', async () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /requests/i }));

    expect(screen.getByText('DELETE')).toBeDefined();
    expect(screen.queryByText('GET')).toBeNull();
  });
});

describe('CommandPalette environments', () => {
  beforeEach(() => {
    selectEnvironmentMock.mockClear().mockResolvedValue(undefined);
    mockModel = normalizeCollection(
      makeCollection('col-1', [], {
        environments: { dev: { variables: {} }, prod: { variables: {} } },
      }),
      [],
      'dev'
    );
  });

  it('lists the environments, marks the selected one and selects another', async () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /environments/i }));
    expect(screen.getByText('active')).toBeDefined();
    await user.click(screen.getByText('prod'));

    expect(selectEnvironmentMock).toHaveBeenCalledWith('prod');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('CommandPalette owns Send/Save/New-request hotkeys while open', () => {
  const dispatchKeyDown = (init: KeyboardEventInit) =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
    );

  beforeEach(() => {
    setSelectedRequestMock.mockClear();
    requestCreateItemMock.mockClear();
    discardChangesMock.mockClear();
    sendRequestMock.mockClear().mockResolvedValue(undefined);
    saveRequestMock.mockClear().mockResolvedValue(undefined);
    mockModel = makeModel();
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
    mockCurrentRequest = {
      ...makeRequest('req-1', 'col-1', 'Req', RequestMethod.GET),
      draft: true,
    };
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    dispatchKeyDown({ key: 's', metaKey: true });

    await waitFor(() => expect(saveRequestMock).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('mod+s does nothing when there is no draft to save', () => {
    mockCurrentRequest = {
      ...makeRequest('req-1', 'col-1', 'Req', RequestMethod.GET),
      draft: false,
    };
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    dispatchKeyDown({ key: 's', metaKey: true });

    expect(saveRequestMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('mod+n requests the sidebar inline-create flow for a request at the collection root and closes the palette', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    dispatchKeyDown({ key: 'n', metaKey: true });

    expect(requestCreateItemMock).toHaveBeenCalledWith({ type: 'request', parentId: 'col-1' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking "New request" in the Actions tab requests the sidebar inline-create flow and closes the palette', async () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /actions/i }));
    await user.click(screen.getByText('New request'));

    expect(requestCreateItemMock).toHaveBeenCalledWith({ type: 'request', parentId: 'col-1' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes immediately on mod+enter without waiting for sendRequest to resolve', () => {
    mockCurrentRequest = makeRequest('req-1', 'col-1', 'Req', RequestMethod.GET);
    let resolveSend: () => void = () => {};
    sendRequestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        })
    );
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    dispatchKeyDown({ key: 'Enter', metaKey: true });

    expect(sendRequestMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled(); // already closed, the send promise below is still pending
    resolveSend();
  });

  it('closes immediately on mod+s without waiting for saveRequest to resolve', () => {
    mockCurrentRequest = {
      ...makeRequest('req-1', 'col-1', 'Req', RequestMethod.GET),
      draft: true,
    };
    let resolveSave: () => void = () => {};
    saveRequestMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    dispatchKeyDown({ key: 's', metaKey: true });

    expect(saveRequestMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled(); // already closed, the save promise below is still pending
    resolveSave();
  });

  it('does not own its hotkeys while closed, so nothing fires', () => {
    mockCurrentRequest = {
      ...makeRequest('req-1', 'col-1', 'Req', RequestMethod.GET),
      draft: true,
    };
    const onClose = vi.fn();
    render(<CommandPalette open={false} onClose={onClose} />);

    dispatchKeyDown({ key: 'Enter', metaKey: true });
    dispatchKeyDown({ key: 's', metaKey: true });
    dispatchKeyDown({ key: 'n', metaKey: true });

    expect(sendRequestMock).not.toHaveBeenCalled();
    expect(saveRequestMock).not.toHaveBeenCalled();
    expect(requestCreateItemMock).not.toHaveBeenCalled();
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
      window.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
      );
    });

  const activeTabName = () => screen.getByRole('tab', { selected: true }).textContent ?? '';

  beforeEach(() => {
    mockModel = makeModel();
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

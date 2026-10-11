import { render, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SidebarHeaderBar } from './SidebarHeaderBar';
import { SortMode, SORT_CYCLE } from './SidebarRequestList/treeUtilities';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useViewStore } from '@/state/viewStore';
import { useHistoryStore } from '@/state/historyStore';
import type { HistoryEntrySummary } from 'shim/history';
import { RequestMethod } from 'shim/objects/request-method';

const renderWithProvider = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

const setSortModeMock = vi.fn();
let currentSortMode: SortMode = SortMode.DEFAULT;

interface MockCollectionState {
  collection: {
    id: string;
    title: string;
    type: 'collection';
    children: [];
  };
  sortMode: SortMode;
}

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: <T,>(selector: (state: MockCollectionState) => T) =>
    selector({
      collection: { id: 'col-1', title: 'Test Collection', type: 'collection', children: [] },
      sortMode: currentSortMode,
    }),
  useCollectionActions: () => ({
    setSortMode: setSortModeMock,
    addNewRequest: vi.fn(),
    addNewFolder: vi.fn(),
  }),
}));

const { clearHistoryMock } = vi.hoisted(() => ({
  clearHistoryMock: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: { clearHistory: () => clearHistoryMock() } },
}));

const historyEntry: HistoryEntrySummary = {
  id: 'entry',
  requestId: 'request',
  requestTitle: 'Request',
  timestamp: 0,
  method: RequestMethod.GET,
  url: 'https://example.com',
  outcome: { type: 'aborted' },
};

vi.mock('@/components/sidebar/CollectionDropdown', () => ({
  default: () => <div>CollectionDropdown</div>,
}));

vi.mock('@/components/shared/settings/CollectionSettingsModal', () => ({
  CollectionSettingsModal: () => null,
}));

describe('SidebarHeaderBar sort cycle', () => {
  beforeEach(() => {
    setSortModeMock.mockClear();
    currentSortMode = SortMode.DEFAULT;
  });

  it('calls setSortMode with the next mode when sort button is clicked', () => {
    const { getByRole } = renderWithProvider(<SidebarHeaderBar />);
    const sortButton = getByRole('button', { name: /sort collection/i });

    fireEvent.click(sortButton);

    expect(setSortModeMock).toHaveBeenCalledWith(SORT_CYCLE[1]); // SortMode.AZ_ASC
  });

  it('cycles back to default after the last mode', () => {
    currentSortMode = SORT_CYCLE[SORT_CYCLE.length - 1]; // SortMode.TIME_ASC
    const { getByRole } = renderWithProvider(<SidebarHeaderBar />);
    const sortButton = getByRole('button', { name: /sort collection/i });

    fireEvent.click(sortButton);

    expect(setSortModeMock).toHaveBeenCalledWith(SortMode.DEFAULT);
  });

  it('shows the correct tooltip label when hovering the sort button', async () => {
    const user = userEvent.setup();
    currentSortMode = SortMode.AZ_ASC;
    renderWithProvider(<SidebarHeaderBar />);

    const sortButton = screen.getByRole('button', { name: /sort collection/i });
    await user.hover(sortButton);

    expect((await screen.findAllByText('A → Z')).length).toBeGreaterThan(0);
  });
});

describe('SidebarHeaderBar mod+n hotkey ownership while command palette is open', () => {
  // @/state/viewStore is not mocked in this file (real, self-contained store) — same convention
  // used for openCollectionSettings above; toggle it directly for the gating assertions.

  const dispatchModN = () =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true, cancelable: true })
    );

  beforeEach(() => {
    useViewStore.setState({ pendingCreateItem: null });
    useViewStore.getState().closeCommandPalette();
  });

  afterEach(() => {
    useViewStore.getState().closeCommandPalette();
  });

  it('does not open the new-request modal via mod+n while the command palette is open', () => {
    useViewStore.getState().openCommandPalette();
    renderWithProvider(<SidebarHeaderBar />);

    dispatchModN();

    expect(useViewStore.getState().pendingCreateItem).toBeNull();
  });

  it('still opens the new-request modal via mod+n when the command palette is closed', () => {
    renderWithProvider(<SidebarHeaderBar />);

    dispatchModN();

    expect(useViewStore.getState().pendingCreateItem).toEqual({
      type: 'request',
      parentId: 'col-1',
    });
  });
});

describe('SidebarHeaderBar history toggle', () => {
  const historyButton = () => screen.getByRole('button', { name: 'Request history' });

  beforeEach(() => {
    useViewStore.setState({ pendingCreateItem: null });
    clearHistoryMock.mockClear();
    useViewStore.setState({ sidebarView: 'requests' });
    useHistoryStore.setState({ entries: [] });
  });

  it('toggles the sidebar between the requests and the history', async () => {
    renderWithProvider(<SidebarHeaderBar />);
    expect(historyButton().getAttribute('aria-pressed')).toBe('false');

    await userEvent.click(historyButton());
    expect(useViewStore.getState().sidebarView).toBe('history');
    expect(historyButton().getAttribute('aria-pressed')).toBe('true');

    await userEvent.click(historyButton());
    expect(useViewStore.getState().sidebarView).toBe('requests');
  });

  it('shows the history count and clear action instead of the request actions', async () => {
    useViewStore.setState({ sidebarView: 'history' });
    useHistoryStore.setState({ entries: [historyEntry] });
    renderWithProvider(<SidebarHeaderBar />);

    screen.getByText('1 request in this session');
    expect(screen.queryByRole('button', { name: 'Add new request' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sort collection' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(clearHistoryMock).toHaveBeenCalledOnce();
  });

  it('disables clearing an empty history', () => {
    useViewStore.setState({ sidebarView: 'history' });
    renderWithProvider(<SidebarHeaderBar />);

    expect(screen.getByRole('button', { name: 'Clear history' })).toHaveProperty('disabled', true);
  });

  it('requests a new request in the request tree via the add button', async () => {
    renderWithProvider(<SidebarHeaderBar />);

    await userEvent.click(screen.getByRole('button', { name: 'Add new request' }));

    expect(useViewStore.getState().pendingCreateItem).toEqual({
      type: 'request',
      parentId: 'col-1',
    });
  });

  it('switches back to the requests before creating a request via mod+n', () => {
    useViewStore.setState({ sidebarView: 'history' });
    renderWithProvider(<SidebarHeaderBar />);

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true, cancelable: true })
    );

    expect(useViewStore.getState().sidebarView).toBe('requests');
    expect(useViewStore.getState().pendingCreateItem).toEqual({
      type: 'request',
      parentId: 'col-1',
    });
  });
});

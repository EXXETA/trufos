import { render, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SidebarHeaderBar } from './SidebarHeaderBar';
import { SortMode, SORT_CYCLE } from './SidebarRequestList/treeUtilities';
import { TooltipProvider } from '@/components/ui/tooltip';

const renderWithProvider = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

const setSortModeMock = vi.fn();
let currentSortMode: SortMode = 'default';

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: (selector: (state: any) => any) =>
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

vi.mock('@/components/sidebar/CollectionDropdown', () => ({
  default: () => <div>CollectionDropdown</div>,
}));

vi.mock('@/components/sidebar/CollectionSettings', () => ({
  CollectionSettings: () => null,
}));

vi.mock('@/components/sidebar/SidebarRequestList/Nav/Dropdown/modals/NamingModal', () => ({
  NamingModal: () => null,
}));

describe('SidebarHeaderBar sort cycle', () => {
  beforeEach(() => {
    setSortModeMock.mockClear();
    currentSortMode = 'default';
  });

  it('calls setSortMode with the next mode when sort button is clicked', () => {
    const { getByRole } = renderWithProvider(<SidebarHeaderBar />);
    const sortButton = getByRole('button', { name: /sort collection/i });

    fireEvent.click(sortButton);

    expect(setSortModeMock).toHaveBeenCalledWith(SORT_CYCLE[1]); // 'az-asc'
  });

  it('cycles back to default after the last mode', () => {
    currentSortMode = SORT_CYCLE[SORT_CYCLE.length - 1]; // 'time-desc'
    const { getByRole } = renderWithProvider(<SidebarHeaderBar />);
    const sortButton = getByRole('button', { name: /sort collection/i });

    fireEvent.click(sortButton);

    expect(setSortModeMock).toHaveBeenCalledWith('default');
  });

  it('shows the correct tooltip label when hovering the sort button', async () => {
    const user = userEvent.setup();
    currentSortMode = 'az-asc';
    renderWithProvider(<SidebarHeaderBar />);

    const sortButton = screen.getByRole('button', { name: /sort collection/i });
    await user.hover(sortButton);

    expect((await screen.findAllByText('A → Z')).length).toBeGreaterThan(0);
  });
});

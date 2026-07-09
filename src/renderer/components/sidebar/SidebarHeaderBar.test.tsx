import { render, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SidebarHeaderBar } from './SidebarHeaderBar';
import { SortMode, SORT_CYCLE } from './SidebarRequestList/treeUtilities';
import { TooltipProvider } from '@/components/ui/tooltip';

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

interface MockAppState extends MockCollectionState {
  isCollectionRunnerOpen: boolean;
  isCollectionSettingsOpen: boolean;
  openCollectionRunner(): void;
  closeCollectionRunner(): void;
  openCollectionSettings(): void;
  closeCollectionSettings(): void;
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
  useAppStore: <T,>(selector: (state: MockAppState) => T) =>
    selector({
      collection: { id: 'col-1', title: 'Test Collection', type: 'collection', children: [] },
      sortMode: currentSortMode,
      isCollectionRunnerOpen: false,
      isCollectionSettingsOpen: false,
      openCollectionRunner: vi.fn(),
      closeCollectionRunner: vi.fn(),
      openCollectionSettings: vi.fn(),
      closeCollectionSettings: vi.fn(),
    }),
}));

vi.mock('@/components/sidebar/CollectionDropdown', () => ({
  default: () => <div>CollectionDropdown</div>,
}));

vi.mock('@/components/shared/settings/CollectionSettingsModal', () => ({
  CollectionSettingsModal: () => null,
}));

describe('SidebarHeaderBar sort cycle', () => {
  const onCreateItem = vi.fn();

  beforeEach(() => {
    setSortModeMock.mockClear();
    onCreateItem.mockClear();
    currentSortMode = SortMode.DEFAULT;
  });

  it('calls setSortMode with the next mode when sort button is clicked', () => {
    const { getByRole } = renderWithProvider(<SidebarHeaderBar onCreateItem={onCreateItem} />);
    const sortButton = getByRole('button', { name: /sort collection/i });

    fireEvent.click(sortButton);

    expect(setSortModeMock).toHaveBeenCalledWith(SORT_CYCLE[1]); // SortMode.AZ_ASC
  });

  it('cycles back to default after the last mode', () => {
    currentSortMode = SORT_CYCLE[SORT_CYCLE.length - 1]; // SortMode.TIME_ASC
    const { getByRole } = renderWithProvider(<SidebarHeaderBar onCreateItem={onCreateItem} />);
    const sortButton = getByRole('button', { name: /sort collection/i });

    fireEvent.click(sortButton);

    expect(setSortModeMock).toHaveBeenCalledWith(SortMode.DEFAULT);
  });

  it('shows the correct tooltip label when hovering the sort button', async () => {
    const user = userEvent.setup();
    currentSortMode = SortMode.AZ_ASC;
    renderWithProvider(<SidebarHeaderBar onCreateItem={onCreateItem} />);

    const sortButton = screen.getByRole('button', { name: /sort collection/i });
    await user.hover(sortButton);

    expect((await screen.findAllByText('A → Z')).length).toBeGreaterThan(0);
  });
});

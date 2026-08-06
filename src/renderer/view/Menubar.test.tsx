import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Menubar } from './Menubar';
import { useViewStore } from '@/state/viewStore';
import type { CreatingItem } from '@/components/sidebar/SidebarRequestList/types';
import { SidebarProvider } from '@/components/ui/sidebar';

const renderMenubar = () =>
  render(
    <SidebarProvider>
      <Menubar />
    </SidebarProvider>
  );

// SidebarProvider itself renders <Toaster /> (components/ui/sonner.tsx), which needs a
// ThemeProvider ancestor that in turn needs jsdom's window.matchMedia — unrelated to what this
// test verifies (the pendingCreateItem bridge), so stub it out rather than wiring up theme context.
vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}));

// Stub the heavy sidebar subtree — this test only cares whether Menubar folds viewStore's
// pendingCreateItem into the creatingItem prop it passes down, not the subtree's own rendering.
vi.mock('@/components/sidebar/SidebarHeaderBar', () => ({
  SidebarHeaderBar: () => <div>SidebarHeaderBar</div>,
}));

vi.mock('@/components/sidebar/FooterBar', () => ({
  FooterBar: () => <div>FooterBar</div>,
}));

vi.mock('@/components/sidebar/SidebarRequestList/SidebarRequestList', () => ({
  SidebarRequestList: ({
    creatingItem,
    onCreateItem,
  }: {
    creatingItem: CreatingItem;
    onCreateItem: (item: CreatingItem) => void;
  }) => (
    <div>
      <div data-testid="creating-item">{creatingItem ? JSON.stringify(creatingItem) : 'none'}</div>
      {/* Mirrors NavCreateItem.tsx's onCancel — the real sidebar's own way of clearing creatingItem */}
      <button onClick={() => onCreateItem(null)}>Cancel create</button>
    </div>
  ),
}));

// @/state/viewStore is not mocked — real, self-contained store; toggled directly, same
// convention SidebarHeaderBar.test.tsx already uses.
describe('Menubar pendingCreateItem bridge', () => {
  beforeEach(() => {
    act(() => {
      useViewStore.getState().requestCreateItem(null);
    });
  });

  it('renders with no creating item by default', () => {
    renderMenubar();

    expect(screen.getByTestId('creating-item').textContent).toBe('none');
  });

  it('folds a pendingCreateItem request into SidebarRequestList and clears it from the store', async () => {
    renderMenubar();

    act(() => {
      useViewStore.getState().requestCreateItem({ type: 'request', parentId: 'col-1' });
    });

    expect(
      await screen.findByText(JSON.stringify({ type: 'request', parentId: 'col-1' }))
    ).toBeDefined();
    expect(useViewStore.getState().pendingCreateItem).toBeNull();
  });

  it('re-fires for a second identical request rather than silently no-oping', async () => {
    const item: CreatingItem = { type: 'request', parentId: 'col-1' };
    const user = userEvent.setup();
    renderMenubar();

    act(() => {
      useViewStore.getState().requestCreateItem(item);
    });
    expect(await screen.findByText(JSON.stringify(item))).toBeDefined();
    expect(useViewStore.getState().pendingCreateItem).toBeNull();

    // Simulate the sidebar cancelling the creation (NavCreateItem.tsx's onCancel), clearing
    // Menubar's local creatingItem back to null.
    await user.click(screen.getByText('Cancel create'));
    expect(screen.getByTestId('creating-item').textContent).toBe('none');

    // Requesting the exact same value again must still re-fire the effect — pendingCreateItem
    // is cleared back to null immediately after being consumed (viewStore.ts's requestCreateItem)
    // specifically so this transition (null -> item) always looks like a change to Zustand/React,
    // even when the item's shape is identical to the previous request.
    act(() => {
      useViewStore.getState().requestCreateItem(item);
    });

    expect(await screen.findByText(JSON.stringify(item))).toBeDefined();
    expect(useViewStore.getState().pendingCreateItem).toBeNull();
  });
});

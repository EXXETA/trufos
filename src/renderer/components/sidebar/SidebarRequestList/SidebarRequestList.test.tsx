import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CollectionStoreProvider, createCollectionStore } from '@/state/collectionStore';
import { SortMode } from 'shim/sort-mode';
import { FakeCollectionMain } from '@/__mocks__/fake-collection-main';
import { makeCollection, makeRequest } from 'shim/__mocks__/collection-fixtures';
import { normalizeCollection } from 'shim/collection-model';
import { SidebarRequestList } from './SidebarRequestList';

// SidebarProvider renders a Toaster, which needs a theme context unrelated to this test
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: {} },
}));

vi.mock('@/lib/ipc-stream', () => ({ IpcPushStream: { open: vi.fn() } }));

function setup() {
  const main = new FakeCollectionMain(
    normalizeCollection(
      makeCollection('col', [
        makeRequest('a', 'col', { title: 'Bravo', lastModified: 2 }),
        makeRequest('b', 'col', { title: 'Alpha', lastModified: 1 }),
      ])
    )
  );
  const { store, collectionState } = createCollectionStore(
    { model: structuredClone(main.model) },
    (envelope) => main.dispatch(envelope),
    main.getCollectionState
  );
  main.onEvent((event) => collectionState.receive(event));
  render(
    <CollectionStoreProvider value={store}>
      <SidebarProvider>
        <SidebarRequestList creatingItem={null} onCreateItem={() => {}} />
      </SidebarProvider>
    </CollectionStoreProvider>
  );
  return store;
}

const titles = () => screen.getAllByText(/^(Alpha|Bravo)$/).map((element) => element.textContent);

describe('SidebarRequestList', () => {
  it('sorts the requests by the selected sort mode', () => {
    const store = setup();
    expect(titles()).toEqual(['Bravo', 'Alpha']);

    act(() => store.getState().setSortMode(SortMode.AZ_ASC));
    expect(titles()).toEqual(['Alpha', 'Bravo']);

    act(() => store.getState().setSortMode(SortMode.TIME_ASC));
    expect(titles()).toEqual(['Alpha', 'Bravo']);

    act(() => store.getState().setSortMode(SortMode.TIME_DESC));
    expect(titles()).toEqual(['Bravo', 'Alpha']);
  });

  it('re-sorts when a request is renamed', async () => {
    const store = setup();
    act(() => store.getState().setSortMode(SortMode.AZ_ASC));

    await act(() => store.getState().renameItem('a', 'Aardvark'));

    expect(screen.getAllByText(/^(Alpha|Aardvark)$/).map((e) => e.textContent)).toEqual([
      'Aardvark',
      'Alpha',
    ]);
  });
});

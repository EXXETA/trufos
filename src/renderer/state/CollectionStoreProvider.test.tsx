import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { CollectionStoreProvider } from './CollectionStoreProvider';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { SortMode } from 'shim/sort-mode';
import { MainProcessEvent, RendererEvent } from 'shim/event-service';
import { CommandType } from 'shim/collection-model';
import { FakeCollectionMain } from '@/__mocks__/fake-collection-main';
import { makeModel } from 'shim/__mocks__/collection-fixtures';

const { listeners, eventService, models } = vi.hoisted(() => {
  const listeners = new Map<string, (...args: unknown[]) => unknown>();
  return {
    listeners,
    eventService: {
      on: vi.fn(),
      removeListener: vi.fn(),
      emit: vi.fn(),
      getCollectionState: vi.fn(),
      dispatch: vi.fn(),
      saveCollectionUiState: vi.fn(),
      flushCollection: vi.fn(),
      reloadCollection: vi.fn(),
      reloadCollectionIfChanged: vi.fn(),
    },
    models: {
      flushModelEdits: vi.fn(),
      cancelModelEdits: vi.fn(),
      createModelsForRequest: vi.fn(),
      disposeModelsForRequest: vi.fn(),
    },
  };
});

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: eventService },
}));

vi.mock('@/lib/monaco/models', () => models);

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: { open: vi.fn() },
}));

vi.mock('@/error/errorHandler', () => ({
  showError: vi.fn(),
}));

let main: FakeCollectionMain;

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
  main = new FakeCollectionMain(makeModel());
  main.onEvent((event) => listeners.get(MainProcessEvent.CollectionStateChanged)?.({}, event));
  eventService.on.mockImplementation((event: string, listener: (...args: unknown[]) => void) => {
    listeners.set(event, listener);
    return eventService;
  });
  eventService.removeListener.mockImplementation((event: string) => {
    listeners.delete(event);
    return eventService;
  });
  eventService.getCollectionState.mockImplementation(main.getCollectionState);
  eventService.dispatch.mockImplementation(main.dispatch);
  models.flushModelEdits.mockResolvedValue(undefined);
  eventService.saveCollectionUiState.mockResolvedValue(undefined);
  eventService.flushCollection.mockResolvedValue(undefined);
  eventService.reloadCollection.mockResolvedValue(undefined);
  eventService.reloadCollectionIfChanged.mockResolvedValue(false);
});

const Title = () => <span>{useCollectionStore((state) => state.collection.title)}</span>;

const renderProvider = () =>
  render(
    <CollectionStoreProvider>
      <Title />
    </CollectionStoreProvider>
  );

describe('CollectionStoreProvider', () => {
  it('renders the children once the collection state is loaded', async () => {
    renderProvider();

    expect(await screen.findByText('Test')).toBeDefined();
  });

  it('applies collection state changes broadcast by main', async () => {
    renderProvider();
    await screen.findByText('Test');

    await act(() =>
      main.dispatch({
        commandId: 'foreign',
        timestamp: 1,
        command: { type: CommandType.UPDATE_COLLECTION, changes: { title: 'Renamed' } },
      })
    );

    expect(screen.getByText('Renamed')).toBeDefined();
  });

  it('flushes editor changes before the window closes', async () => {
    renderProvider();
    await screen.findByText('Test');

    await act(async () => {
      await listeners.get(MainProcessEvent.BeforeClose)?.({});
    });

    expect(models.flushModelEdits).toHaveBeenCalledOnce();
    expect(eventService.emit).toHaveBeenCalledWith(RendererEvent.ReadyToClose);
  });

  it('sends the UI state to main before the window closes', async () => {
    const SortAlphabetically = () => {
      const { setSortMode } = useCollectionActions();
      useEffect(() => setSortMode(SortMode.AZ_ASC), [setSortMode]);
      return <Title />;
    };
    render(
      <CollectionStoreProvider>
        <SortAlphabetically />
      </CollectionStoreProvider>
    );
    await screen.findByText('Test');

    await act(async () => {
      await listeners.get(MainProcessEvent.BeforeClose)?.({});
    });

    expect(eventService.saveCollectionUiState).toHaveBeenCalledWith(
      main.model.collection.dirPath,
      expect.objectContaining({ sortMode: SortMode.AZ_ASC })
    );
    expect(eventService.saveCollectionUiState.mock.invocationCallOrder[0]).toBeLessThan(
      eventService.emit.mock.invocationCallOrder[0]
    );
  });

  it('writes everything to disk when the window loses focus, editor changes first', async () => {
    renderProvider();
    await screen.findByText('Test');

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    await waitFor(() => expect(eventService.flushCollection).toHaveBeenCalledOnce());
    expect(models.flushModelEdits.mock.invocationCallOrder[0]).toBeLessThan(
      eventService.flushCollection.mock.invocationCallOrder[0]
    );
  });

  it('reloads the collection if it changed on disk when the window gets focus', async () => {
    renderProvider();
    await screen.findByText('Test');

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(eventService.reloadCollectionIfChanged).toHaveBeenCalledOnce());
    expect(eventService.reloadCollection).not.toHaveBeenCalled();
  });

  it('reloads the collection from the Collection menu', async () => {
    renderProvider();
    await screen.findByText('Test');

    await act(async () => {
      listeners.get(MainProcessEvent.ReloadCollection)?.({});
    });

    await waitFor(() => expect(eventService.reloadCollection).toHaveBeenCalledOnce());
  });

  it('stops following the window focus on unmount', async () => {
    const { unmount } = renderProvider();
    await screen.findByText('Test');

    unmount();
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));

    expect(eventService.flushCollection).not.toHaveBeenCalled();
    expect(eventService.reloadCollectionIfChanged).not.toHaveBeenCalled();
  });

  it('removes its listeners on unmount', async () => {
    const { unmount } = renderProvider();
    await screen.findByText('Test');

    unmount();

    await waitFor(() => expect(listeners.size).toBe(0));
  });
});

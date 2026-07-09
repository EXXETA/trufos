import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { CollectionStoreProvider } from './CollectionStoreProvider';
import { AppStoreState, useAppStore } from './collectionStore';

const listeners: Record<string, (...args: unknown[]) => void> = {};

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners[event] = listener;
      }),
      emit: vi.fn(),
      selectEnvironment: vi.fn().mockResolvedValue(undefined),
      loadCollection: vi.fn().mockResolvedValue({
        id: 'col-1',
        type: 'collection',
        title: 'Test',
        dirPath: '/test',
        children: [],
        variables: {},
        environments: {},
        lastModified: 0,
        isDefault: false,
      }),
    },
  },
}));

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: { open: vi.fn() },
}));

vi.mock('@/lib/monaco/models', () => ({
  REQUEST_MODEL: { getValue: vi.fn() },
  SCRIPT_MODEL: { getValue: vi.fn() },
}));

vi.mock('@/error/errorHandler', () => ({
  showError: vi.fn(),
}));

vi.mock('@/state/helper/collectionUtil', () => ({
  isRequestInAParentFolder: vi.fn(() => false),
}));

let appState: AppStoreState | undefined;

const StoreProbe = () => {
  appState = useAppStore((state) => state);
  return null;
};

beforeEach(() => {
  appState = undefined;
});

describe('CollectionStoreProvider', () => {
  it('updates root store variables and environments when collection-variables-updated is received', async () => {
    render(
      <CollectionStoreProvider>
        <StoreProbe />
      </CollectionStoreProvider>
    );

    await waitFor(() => expect(listeners['collection-variables-updated']).toBeDefined());

    const testVariables = { apiKey: { value: 'test-123' } };
    const testEnvironments = { dev: { variables: { host: { value: 'localhost' } } } };

    act(() => {
      listeners['collection-variables-updated'](
        {}, // ipcRendererEvent (ignored)
        { variables: testVariables, environments: testEnvironments }
      );
    });

    expect(appState?.variables).toEqual(testVariables);
    expect(appState?.environments).toEqual(testEnvironments);
  });

  it('does not update stores when event is not fired', async () => {
    render(
      <CollectionStoreProvider>
        <StoreProbe />
      </CollectionStoreProvider>
    );

    await waitFor(() => expect(listeners['collection-variables-updated']).toBeDefined());

    expect(appState?.variables).toEqual({});
    expect(appState?.environments).toEqual({});
  });
});

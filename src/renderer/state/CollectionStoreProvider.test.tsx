import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { CollectionStoreProvider } from './CollectionStoreProvider';
import { useVariableStore } from '@/state/variableStore';
import { useEnvironmentStore } from '@/state/environmentStore';

const listeners: Record<string, (...args: unknown[]) => void> = {};

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners[event] = listener;
      }),
      emit: vi.fn(),
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

beforeEach(() => {
  useVariableStore.getState().initialize({});
  useEnvironmentStore.getState().initialize({});
});

describe('CollectionStoreProvider', () => {
  it('updates variableStore and environmentStore when collection-variables-updated is received', async () => {
    render(
      <CollectionStoreProvider>
        <div />
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

    expect(useVariableStore.getState().variables).toEqual(testVariables);
    expect(useEnvironmentStore.getState().environments).toEqual(testEnvironments);
  });

  it('does not update stores when event is not fired', async () => {
    render(
      <CollectionStoreProvider>
        <div />
      </CollectionStoreProvider>
    );

    await waitFor(() => expect(listeners['collection-variables-updated']).toBeDefined());

    expect(useVariableStore.getState().variables).toEqual({});
    expect(useEnvironmentStore.getState().environments).toEqual({});
  });
});

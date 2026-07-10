import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createAppStore } from './appStore';
import { Collection } from 'shim/objects/collection';

const selectEnvironmentMock = vi.fn().mockResolvedValue(undefined);
const setEnvironmentVariablesMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: { open: vi.fn() },
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      selectEnvironment: (key?: string) => selectEnvironmentMock(key),
      setEnvironmentVariables: (environments: unknown) => setEnvironmentVariablesMock(environments),
    },
  },
}));

describe('environmentStore', () => {
  let store: ReturnType<typeof createAppStore>;

  beforeEach(() => {
    selectEnvironmentMock.mockClear();
    setEnvironmentVariablesMock.mockClear();
    store = createAppStore({
      id: 'col-1',
      parentId: null,
      type: 'collection',
      title: 'Test',
      dirPath: '/test',
      children: [],
      variables: {},
      environments: {},
      lastModified: 0,
      isDefault: false,
    } as Collection);
  });

  describe('initialize', () => {
    it('auto-selects the first environment and propagates it to the main process', () => {
      store.getState().initializeEnvironments({ dev: { variables: {} }, prod: { variables: {} } });

      expect(store.getState().selectedEnvironment).toBe('dev');
      expect(selectEnvironmentMock).toHaveBeenCalledWith('dev');
    });

    it('keeps an existing selection and does not send redundant IPC calls', () => {
      store.setState({ selectedEnvironment: 'prod' });

      store.getState().initializeEnvironments({ dev: { variables: {} }, prod: { variables: {} } });

      expect(store.getState().selectedEnvironment).toBe('prod');
      expect(selectEnvironmentMock).not.toHaveBeenCalled();
    });

    it('resets an existing selection that is missing in the new environments', () => {
      store.setState({ selectedEnvironment: 'prod' });

      store.getState().initializeEnvironments({ dev: { variables: {} } });

      expect(store.getState().selectedEnvironment).toBe('dev');
      expect(selectEnvironmentMock).toHaveBeenCalledWith('dev');
    });

    it('does not select anything when there are no environments', () => {
      store.getState().initializeEnvironments({});

      expect(store.getState().selectedEnvironment).toBeUndefined();
      expect(selectEnvironmentMock).not.toHaveBeenCalled();
    });
  });

  describe('selectEnvironment', () => {
    it('updates the state and notifies the main process', async () => {
      await store.getState().selectEnvironment('prod');

      expect(store.getState().selectedEnvironment).toBe('prod');
      expect(selectEnvironmentMock).toHaveBeenCalledWith('prod');
    });

    it('clears the selection when called without a key', async () => {
      store.setState({ selectedEnvironment: 'dev' });

      await store.getState().selectEnvironment(undefined);

      expect(store.getState().selectedEnvironment).toBeUndefined();
      expect(selectEnvironmentMock).toHaveBeenCalledWith(undefined);
    });
  });
});

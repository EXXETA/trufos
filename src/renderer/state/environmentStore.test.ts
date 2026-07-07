import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useEnvironmentStore } from './environmentStore';

const selectEnvironmentMock = vi.fn().mockResolvedValue(undefined);
const setEnvironmentVariablesMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      selectEnvironment: (key?: string) => selectEnvironmentMock(key),
      setEnvironmentVariables: (environments: unknown) => setEnvironmentVariablesMock(environments),
    },
  },
}));

describe('environmentStore', () => {
  beforeEach(() => {
    selectEnvironmentMock.mockClear();
    setEnvironmentVariablesMock.mockClear();
    useEnvironmentStore.setState({ environments: {}, selectedEnvironment: undefined });
  });

  describe('initialize', () => {
    it('auto-selects the first environment and propagates it to the main process', () => {
      useEnvironmentStore
        .getState()
        .initialize({ dev: { variables: {} }, prod: { variables: {} } });

      expect(useEnvironmentStore.getState().selectedEnvironment).toBe('dev');
      expect(selectEnvironmentMock).toHaveBeenCalledWith('dev');
    });

    it('keeps an existing selection and does not send redundant IPC calls', () => {
      useEnvironmentStore.setState({ selectedEnvironment: 'prod' });

      useEnvironmentStore
        .getState()
        .initialize({ dev: { variables: {} }, prod: { variables: {} } });

      expect(useEnvironmentStore.getState().selectedEnvironment).toBe('prod');
      expect(selectEnvironmentMock).not.toHaveBeenCalled();
    });

    it('resets an existing selection that is missing in the new environments', () => {
      useEnvironmentStore.setState({ selectedEnvironment: 'prod' });

      useEnvironmentStore.getState().initialize({ dev: { variables: {} } });

      expect(useEnvironmentStore.getState().selectedEnvironment).toBe('dev');
      expect(selectEnvironmentMock).toHaveBeenCalledWith('dev');
    });

    it('does not select anything when there are no environments', () => {
      useEnvironmentStore.getState().initialize({});

      expect(useEnvironmentStore.getState().selectedEnvironment).toBeUndefined();
      expect(selectEnvironmentMock).not.toHaveBeenCalled();
    });
  });

  describe('selectEnvironment', () => {
    it('updates the state and notifies the main process', async () => {
      await useEnvironmentStore.getState().selectEnvironment('prod');

      expect(useEnvironmentStore.getState().selectedEnvironment).toBe('prod');
      expect(selectEnvironmentMock).toHaveBeenCalledWith('prod');
    });

    it('clears the selection when called without a key', async () => {
      useEnvironmentStore.setState({ selectedEnvironment: 'dev' });

      await useEnvironmentStore.getState().selectEnvironment(undefined);

      expect(useEnvironmentStore.getState().selectedEnvironment).toBeUndefined();
      expect(selectEnvironmentMock).toHaveBeenCalledWith(undefined);
    });
  });
});

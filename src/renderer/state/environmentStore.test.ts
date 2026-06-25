import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEnvironmentStore } from './environmentStore';

const { selectEnvironmentMock, setEnvironmentVariablesMock } = vi.hoisted(() => ({
  selectEnvironmentMock: vi.fn(),
  setEnvironmentVariablesMock: vi.fn(),
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      selectEnvironment: selectEnvironmentMock,
      setEnvironmentVariables: setEnvironmentVariablesMock,
    },
  },
}));

describe('environmentStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectEnvironmentMock.mockResolvedValue(undefined);
    setEnvironmentVariablesMock.mockResolvedValue(undefined);
    useEnvironmentStore.setState({ environments: {}, selectedEnvironment: undefined });
  });

  it('selects the first environment when no environment is selected', () => {
    useEnvironmentStore.getState().initialize({
      dev: { variables: { host: { value: 'localhost' } } },
      prod: { variables: { host: { value: 'example.com' } } },
    });

    expect(useEnvironmentStore.getState().selectedEnvironment).toBe('dev');
    expect(selectEnvironmentMock).toHaveBeenCalledWith('dev');
  });

  it('replaces a stale selected environment when environments change', () => {
    useEnvironmentStore.getState().initialize({
      dev: { variables: { host: { value: 'localhost' } } },
    });

    useEnvironmentStore.getState().initialize({
      prod: { variables: { host: { value: 'example.com' } } },
    });

    expect(useEnvironmentStore.getState().selectedEnvironment).toBe('prod');
    expect(selectEnvironmentMock).toHaveBeenLastCalledWith('prod');
  });

  it('keeps the selected environment valid after saving environments', async () => {
    useEnvironmentStore.getState().initialize({
      dev: { variables: {} },
    });

    await useEnvironmentStore.getState().setEnvironments({
      prod: { variables: {} },
    });

    expect(setEnvironmentVariablesMock).toHaveBeenCalledWith({
      prod: { variables: {} },
    });
    expect(useEnvironmentStore.getState().selectedEnvironment).toBe('prod');
    expect(selectEnvironmentMock).toHaveBeenLastCalledWith('prod');
  });

  it('clears the selection when no environments remain', async () => {
    useEnvironmentStore.getState().initialize({
      dev: { variables: {} },
    });

    await useEnvironmentStore.getState().setEnvironments({});

    expect(useEnvironmentStore.getState().selectedEnvironment).toBeUndefined();
    expect(selectEnvironmentMock).toHaveBeenLastCalledWith(undefined);
  });
});

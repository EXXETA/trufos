import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PluginFileArea,
  type PluginContributions,
  type PluginInfo,
  PluginPermissionScope,
  type PluginsSnapshot,
} from 'shim/plugin';

const { getPluginsMock, setPluginEnabledMock, showErrorMock } = vi.hoisted(() => ({
  getPluginsMock: vi.fn<() => Promise<PluginsSnapshot>>(),
  setPluginEnabledMock: vi.fn<(id: string, enabled: boolean) => Promise<void>>(),
  showErrorMock: vi.fn(),
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      getPlugins: () => getPluginsMock(),
      setPluginEnabled: (id: string, enabled: boolean) => setPluginEnabledMock(id, enabled),
    },
  },
}));

vi.mock('@/error/errorHandler', () => ({
  showError: (message: string, error: unknown) => showErrorMock(message, error),
}));

import { usePluginStore } from './pluginStore';

const PLUGIN: PluginInfo = {
  id: 'postman',
  name: 'Postman',
  version: '1.0.0',
  description: 'Imports Postman collections.',
  permissions: [{ scope: PluginPermissionScope.FS, value: PluginFileArea.PICK }],
  enabled: true,
};

const CONTRIBUTIONS: PluginContributions = {
  importers: [
    {
      id: 'postman.collection',
      pluginId: 'postman',
      name: 'Postman',
      source: 'file',
      extensions: ['json'],
    },
  ],
  exporters: [],
};

const SNAPSHOT: PluginsSnapshot = { plugins: [PLUGIN], contributions: CONTRIBUTIONS };

const EMPTY_CONTRIBUTIONS: PluginContributions = { importers: [], exporters: [] };

describe('pluginStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePluginStore.setState({ plugins: [], contributions: EMPTY_CONTRIBUTIONS });
  });

  it('loads the plugins and their contributions', async () => {
    getPluginsMock.mockResolvedValueOnce(SNAPSHOT);

    await usePluginStore.getState().load();

    expect(usePluginStore.getState().plugins).toEqual([PLUGIN]);
    expect(usePluginStore.getState().contributions).toEqual(CONTRIBUTIONS);
  });

  it('reports a failure to load the plugins', async () => {
    getPluginsMock.mockRejectedValueOnce(new Error('boom'));

    await usePluginStore.getState().load();

    expect(showErrorMock).toHaveBeenCalledWith('Could not load the plugins', expect.any(Error));
    expect(usePluginStore.getState().plugins).toEqual([]);
  });

  it('takes over the plugins pushed by the main process', () => {
    usePluginStore.getState().receive(SNAPSHOT);

    expect(usePluginStore.getState().plugins).toEqual([PLUGIN]);
    expect(usePluginStore.getState().contributions).toEqual(CONTRIBUTIONS);
  });

  it('enables a plugin through the main process', async () => {
    setPluginEnabledMock.mockResolvedValueOnce();

    await usePluginStore.getState().setEnabled('postman', false);

    expect(setPluginEnabledMock).toHaveBeenCalledWith('postman', false);
    expect(showErrorMock).not.toHaveBeenCalled();
  });

  it('reports a failure to enable a plugin', async () => {
    setPluginEnabledMock.mockRejectedValueOnce(new Error('boom'));

    await usePluginStore.getState().setEnabled('postman', true);

    expect(showErrorMock).toHaveBeenCalledWith('Could not enable the plugin', expect.any(Error));
  });
});

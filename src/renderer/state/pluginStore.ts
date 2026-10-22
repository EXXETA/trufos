import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { PluginContributions, PluginInfo, PluginsSnapshot } from 'shim/plugin';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useActions } from '@/state/helper/util';
import { showError } from '@/error/errorHandler';

const eventService = RendererEventService.instance;

type PluginState = PluginsSnapshot;

interface PluginActions {
  /** Loads the plugins and their contributions, e.g. when the app starts. */
  load(): Promise<void>;
  /**
   * Takes over a snapshot received from the main process, e.g. the one it pushes after every
   * change.
   * @param snapshot the plugins and their contributions
   */
  receive(snapshot: PluginsSnapshot): void;
  /**
   * Enables or disables a plugin. The store is updated by the change the main process pushes.
   * @param id the ID of the plugin
   * @param enabled whether the plugin is enabled
   */
  setEnabled(id: string, enabled: boolean): Promise<void>;
}

export const usePluginStore = create<PluginState & PluginActions>()(
  immer((set, get) => ({
    plugins: [],
    contributions: { importers: [], exporters: [] },

    async load() {
      try {
        get().receive(await eventService.getPlugins());
      } catch (error) {
        showError('Could not load the plugins', error);
      }
    },

    receive(snapshot) {
      set(() => snapshot);
    },

    async setEnabled(id, enabled) {
      try {
        await eventService.setPluginEnabled(id, enabled);
      } catch (error) {
        showError(`Could not ${enabled ? 'enable' : 'disable'} the plugin`, error);
      }
    },
  }))
);

export const selectPlugins = (state: PluginState): PluginInfo[] => state.plugins;
export const selectPluginContributions = (state: PluginState): PluginContributions =>
  state.contributions;
export const usePluginActions = () => usePluginStore(useActions());

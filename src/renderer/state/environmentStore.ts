import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { EnvironmentMap } from 'shim/objects/environment';
import { useActions } from '@/state/helper/util';
import { RendererEventService } from '@/services/event/renderer-event-service';

const eventService = RendererEventService.instance;

interface EnvironmentState {
  /** The environments of the current collection */
  environments: EnvironmentMap;
  /** Currently selected environment key */
  selectedEnvironment?: string;
}

interface EnvironmentActions {
  initialize(environments: EnvironmentMap): void;
  setEnvironments(environments: EnvironmentMap): Promise<void>;
  selectEnvironment(environmentKey?: string): Promise<void>;
  addEnvironment(key: string): void;
  removeEnvironment(key: string): void;
}

export const useEnvironmentStore = create<EnvironmentState & EnvironmentActions>()(
  immer((set, get) => ({
    environments: {},
    selectedEnvironment: undefined,

    initialize(environments: EnvironmentMap) {
      const previousSelection = get().selectedEnvironment;
      const environmentKeys = Object.keys(environments);
      set((state) => {
        state.environments = environments;
        if (state.selectedEnvironment == null || environments[state.selectedEnvironment] == null) {
          state.selectedEnvironment = environmentKeys[0] ?? undefined;
        }
      });
      // The main process resolves variables based on its own selected environment,
      // so an auto-selection here must be propagated via IPC.
      const selection = get().selectedEnvironment;
      if (selection !== previousSelection) {
        eventService.selectEnvironment(selection).catch(console.error);
      }
    },

    setEnvironments: async (environments) => {
      await eventService.setEnvironmentVariables(environments);
      set((state) => {
        state.environments = environments;
      });
    },

    selectEnvironment: async (environmentKey?: string) => {
      await eventService.selectEnvironment(environmentKey);
      set((state) => {
        state.selectedEnvironment = environmentKey;
      });
    },

    addEnvironment(key: string) {
      set((state) => {
        if (!state.environments[key]) {
          state.environments[key] = { variables: {} };
        }
      });
    },

    removeEnvironment(key: string) {
      set((state) => {
        delete state.environments[key];
        if (state.selectedEnvironment === key) {
          const remainingKeys = Object.keys(state.environments);
          state.selectedEnvironment = remainingKeys.length > 0 ? remainingKeys[0] : undefined;
        }
      });
    },
  }))
);

export const selectEnvironments = (state: EnvironmentState) => state.environments;
export const selectSelectedEnvironment = (state: EnvironmentState) => state.selectedEnvironment;
export const useEnvironmentActions = () => useEnvironmentStore(useActions());

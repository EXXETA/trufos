import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { EnvironmentMap } from 'shim/objects/environment';
import { useActions } from '@/state/helper/util';
import { RendererEventService } from '@/services/event/renderer-event-service';

const eventService = RendererEventService.instance;

const getFirstEnvironmentKey = (environments: EnvironmentMap) => Object.keys(environments)[0];

const getValidEnvironmentKey = (environments: EnvironmentMap, environmentKey?: string) =>
  environmentKey != null && environments[environmentKey] != null
    ? environmentKey
    : getFirstEnvironmentKey(environments);

const syncSelectedEnvironment = (environmentKey?: string) => {
  void eventService.selectEnvironment(environmentKey).catch((error) => {
    console.error('Failed to select environment', error);
  });
};

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
      let selectedEnvironment: string | undefined;
      set((state) => {
        selectedEnvironment = getValidEnvironmentKey(environments, state.selectedEnvironment);
        state.environments = environments;
        state.selectedEnvironment = selectedEnvironment;
      });
      syncSelectedEnvironment(selectedEnvironment);
    },

    setEnvironments: async (environments) => {
      await eventService.setEnvironmentVariables(environments);
      let selectedEnvironment: string | undefined;
      set((state) => {
        selectedEnvironment = getValidEnvironmentKey(environments, state.selectedEnvironment);
        state.environments = environments;
        state.selectedEnvironment = selectedEnvironment;
      });
      await eventService.selectEnvironment(selectedEnvironment);
    },

    selectEnvironment: async (environmentKey?: string) => {
      const selectedEnvironment = getValidEnvironmentKey(get().environments, environmentKey);
      await eventService.selectEnvironment(selectedEnvironment);
      set((state) => {
        state.selectedEnvironment = selectedEnvironment;
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

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
  selectedEnvironment: string | null;
}

interface EnvironmentActions {
  initialize(environments: EnvironmentMap): void;
  setEnvironments(environments: EnvironmentMap): Promise<void>;
  selectEnvironment(environmentKey: string | null): void;
  addEnvironment(key: string): void;
  removeEnvironment(key: string): void;
}

export const useEnvironmentStore = create<EnvironmentState & EnvironmentActions>()(
  immer((set) => ({
    environments: {},
    selectedEnvironment: null,

    initialize(environments: EnvironmentMap) {
      set((state) => {
        state.environments = environments;
        if (Object.keys(environments).length > 0 && !state.selectedEnvironment) {
          state.selectedEnvironment = Object.keys(environments)[0];
        }
      });
    },

    setEnvironments: async (environments) => {
      await eventService.setEnvironmentVariables(environments);
      set((state) => {
        state.environments = environments;
      });
    },

    selectEnvironment(environmentKey: string | null) {
      if (environmentKey) {
        eventService.selectEnvironment(environmentKey);
      }
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
          state.selectedEnvironment = remainingKeys.length > 0 ? remainingKeys[0] : null;
        }
      });
    },
  }))
);

export const selectEnvironments = (state: EnvironmentState) => state.environments;
export const selectSelectedEnvironment = (state: EnvironmentState) => state.selectedEnvironment;
export const useEnvironmentActions = () => useEnvironmentStore(useActions());

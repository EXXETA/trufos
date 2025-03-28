import { VariableStateActions } from '@/state/interface/VariableStateAction';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { VariableMap } from 'shim/objects/variables';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useActions } from '@/state/helper/util';
import { EnvironmentMap } from 'shim/objects/environment';

const eventService = RendererEventService.instance;

interface VariableState {
  /** The variables of the current collection */
  collectionVariables: VariableMap;
  environmentVariables: EnvironmentMap;
}

export const useVariableStore = create<VariableState & VariableStateActions>()(
  immer((set, get) => ({
    collectionVariables: {} as VariableMap,
    environmentVariables: {} as EnvironmentMap,

    initialize(collectionVariables: VariableMap, environmentVariables: EnvironmentMap) {
      set((state) => {
        state.collectionVariables = collectionVariables;
        state.environmentVariables = environmentVariables;
      });
    },

    setCollectionVariables: async (variables) => {
      await eventService.setCollectionVariables(variables);
      set((state) => {
        state.collectionVariables = variables;
      });
    },

    setEnvironmentVariables: async (environmentVariables) => {
      await eventService.setEnvironmentVariables(environmentVariables);
      set((state) => {
        state.environmentVariables = environmentVariables;
      });
    },
  }))
);

export const selectCollectionVariables = (state: VariableState) => state.collectionVariables;
export const selectEnvironmentVariables = (state: VariableState) => state.environmentVariables;
export const useVariableActions = () => useVariableStore(useActions());

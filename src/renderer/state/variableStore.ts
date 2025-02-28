import { VariableStateActions } from '@/state/interface/VariableStateAction';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { VariableMap } from '../../shim/objects/variables';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useActions } from '@/state/helper/util';

const eventService = RendererEventService.instance;

interface VariableState {
  /** The variables of the current collection */
  variables: VariableMap;
}

export const useVariableStore = create<VariableState & VariableStateActions>()(
  immer((set, get) => ({
    variables: {},

    initialize(variables: VariableMap) {
      set((state) => {
        state.variables = variables;
      });
    },

    setVariables: async (variables) => {
      await eventService.setCollectionVariables(variables);
      set((state) => {
        state.variables = variables;
      });
    },
  }))
);

export const selectVariables = (state: VariableState) => state.variables;
export const useVariableActions = () => useVariableStore(useActions());

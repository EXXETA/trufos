import { VariableStateActions } from '@/state/interface/VariableStateAction';
import { useActions } from '@/state/helper/util';
import { type VariableState, useAppStore } from '@/state/collectionStore';

type VariableStoreState = VariableState & VariableStateActions;

export const useVariableStore = <T>(selector: (state: VariableStoreState) => T): T =>
  useAppStore((state) =>
    selector({
      variables: state.variables,
      initialize: state.initializeVariables,
      setVariables: state.setVariables,
    })
  );

export const selectVariables = (state: VariableState) => state.variables;
export const useVariableActions = (): VariableStateActions => useVariableStore(useActions());

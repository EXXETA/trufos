import { EnvironmentMap } from 'shim/objects/environment';
import { useActions } from '@/state/helper/util';
import { type EnvironmentState, useAppStore } from '@/state/appStore';

interface EnvironmentActions {
  initialize(environments: EnvironmentMap): void;
  setEnvironments(environments: EnvironmentMap): Promise<void>;
  selectEnvironment(environmentKey?: string): Promise<void>;
  addEnvironment(key: string): void;
  removeEnvironment(key: string): void;
}

type EnvironmentStoreState = EnvironmentState & EnvironmentActions;

export const useEnvironmentStore = <T>(selector: (state: EnvironmentStoreState) => T): T =>
  useAppStore((state) =>
    selector({
      environments: state.environments,
      selectedEnvironment: state.selectedEnvironment,
      initialize: state.initializeEnvironments,
      setEnvironments: state.setEnvironments,
      selectEnvironment: state.selectEnvironment,
      addEnvironment: state.addEnvironment,
      removeEnvironment: state.removeEnvironment,
    })
  );

export const selectEnvironments = (state: EnvironmentState) => state.environments;
export const selectSelectedEnvironment = (state: EnvironmentState) => state.selectedEnvironment;
export const useEnvironmentActions = (): EnvironmentActions => useEnvironmentStore(useActions());

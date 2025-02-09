import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { VariableMap, VariableObject } from 'shim/objects/variables';
import { useCollectionStore } from '@/state/collectionStore';
import { useActions } from '@/state/util';

interface VariableState {
  variables: VariableMap;
  collectionId: string;
  isOpen: boolean;
}

interface VariableStateAction {
  openModal: () => void;
  addNewVariable: () => void;
  deleteVariable: (key: string) => void;
  update: (key: string, changes: Partial<VariableObject>) => void;
  rename: (oldKey: string, newKey: string) => void;
  save: () => Promise<void>;
  cancel: () => void;
}

const defaultState: VariableState = {
  variables: {},
  collectionId: '',
  isOpen: false,
};

export const useVariableStore = create<VariableState & VariableStateAction>()(
  immer((set, get) => ({
    ...defaultState,

    openModal: () => {
      const { collection } = useCollectionStore.getState();
      set({
        variables: collection.variables,
        collectionId: collection.id,
        isOpen: true,
      });
    },

    addNewVariable: () => {
      if (get().variables[''] != null) return;
      set((state) => {
        state.variables[''] = { value: '', description: '' };
      });
    },

    deleteVariable: (key: string) => {
      set((state) => {
        delete state.variables[key];
      });
    },

    update: (key: string, changes: Partial<VariableObject>) => {
      set((state) => {
        state.variables[key] = { ...state.variables[key], ...changes };
      });
    },

    rename: (oldKey: string, newKey: string) => {
      set((state) => {
        state.variables[newKey] = state.variables[oldKey];
        delete state.variables[oldKey];
      });
    },

    save: async () => {
      await useCollectionStore.getState().setVariables(get().variables);
      set(defaultState);
    },

    cancel: () => set(defaultState),
  }))
);

export const useVariableActions = () => useVariableStore(useActions());

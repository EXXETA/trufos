import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { VariableMap, VariableObject } from 'shim/objects/variables';
import { RendererEventService } from '@/services/event/renderer-event-service';

interface VariableState {
  variables: VariableMap;
  collectionId: string;
  isOpen: boolean;
  allDoubleKeys: string[];
  lastInput?: string;
}

interface VariableStateAction {
  openModal: () => void;
  addNewVariable: () => void;
  deleteVariable: (key: string) => void;
  update: (key: string, changes: Partial<VariableObject>) => void;
  rename: (oldKey: string, newKey: string) => void;
  save: () => void;
  cancel: () => void;
}

const defaultState: VariableState = {
  variables: {},
  collectionId: '',
  isOpen: false,
  allDoubleKeys: [],
};

export const useVariableStore = create<VariableState & VariableStateAction>()(
  immer((set, get) => ({
    ...defaultState,

    openModal: () => {
      RendererEventService.instance.loadCollection().then((collection) => {
        set({
          variables: collection.variables,
          collectionId: collection.id,
          isOpen: true,
        });
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

    save: () => {
      RendererEventService.instance.setCollectionVariables(get().variables);
      set(() => defaultState);
    },

    cancel: () => set(() => defaultState),
  }))
);

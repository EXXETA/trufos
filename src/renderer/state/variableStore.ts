import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { VariableObject } from 'shim/variables';
import { RendererEventService } from '@/services/event/renderer-event-service';

interface VariableState {
  variables: VariableObject[];
  collectionId: string;
  isOpen: boolean;
  allDoubleKeys: string[];
  lastInput: string | null;
}

interface VariableStateAction {
  openModal: () => void;
  addNewVariable: () => void;
  deleteVariable: (index: number) => void;
  update: (index: number, changeValue: string | boolean, key: keyof VariableObject) => void;
  save: () => void;
  cancel: () => void;
  checkDuplicate: (key: string) => void;
}

export const useVariableStore = create<VariableState & VariableStateAction>()(
  immer((set, get) => ({
    variables: [],
    collectionId: '',
    isOpen: false,
    allDoubleKeys: [],
    lastInput: null,
    openModal: () => {
      RendererEventService.instance.loadCollection().then((collection) => {
        set({
          variables: Object.values(collection.variables),
          collectionId: collection.id,
          isOpen: true,
        });
      });
    },
    addNewVariable: () => {
      set((state) => {
        state.variables.push({ key: '', value: '', description: '' });
      });
    },
    deleteVariable: (index: number) => {
      set((state) => {
        state.variables.splice(index, 1);
      });
    },
    update: (index: number, changeValue: string | boolean, key: keyof VariableObject) => {
      set((state) => {
        state.variables[index] = { ...state.variables[index], [key]: changeValue };
      });
    },
    save: () => {
      RendererEventService.instance.setCollectionVariables(get().variables);
      set((state) => {
        state.variables = [];
        state.isOpen = false;
        state.lastInput = null;
      });
    },
    cancel: () => {
      set((state) => {
        state.variables = [];
        state.isOpen = false;
        state.allDoubleKeys = [];
        state.lastInput = null;
      });
    },
    checkDuplicate: (key: string) => {
      const isDuplicate = get().variables.filter((variable) => variable.key === key).length > 1;
      set((state) => {
        if (isDuplicate && !state.allDoubleKeys.includes(key)) {
          state.allDoubleKeys.push(key);
        } else {
          state.allDoubleKeys = state.allDoubleKeys.filter(
            (doubleKey) => doubleKey !== get().lastInput
          );
        }
        state.lastInput = key;
      });
    },
  }))
);

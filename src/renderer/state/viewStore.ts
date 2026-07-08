import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useActions } from '@/state/helper/util';

interface ViewState {
  /** Whether the collection runner modal is open */
  isCollectionRunnerOpen: boolean;
  /** Whether the collection settings modal is open */
  isCollectionSettingsOpen: boolean;
}

interface ViewActions {
  openCollectionRunner(): void;
  closeCollectionRunner(): void;
  openCollectionSettings(): void;
  closeCollectionSettings(): void;
}

export const useViewStore = create<ViewState & ViewActions>()(
  immer((set) => ({
    isCollectionRunnerOpen: false,
    isCollectionSettingsOpen: false,

    openCollectionRunner() {
      set((state) => {
        state.isCollectionRunnerOpen = true;
      });
    },

    closeCollectionRunner() {
      set((state) => {
        state.isCollectionRunnerOpen = false;
      });
    },

    openCollectionSettings() {
      set((state) => {
        state.isCollectionSettingsOpen = true;
      });
    },

    closeCollectionSettings() {
      set((state) => {
        state.isCollectionSettingsOpen = false;
      });
    },
  }))
);

export const selectIsCollectionRunnerOpen = (state: ViewState) => state.isCollectionRunnerOpen;
export const selectIsCollectionSettingsOpen = (state: ViewState) => state.isCollectionSettingsOpen;
export const useViewActions = (): ViewActions => useViewStore(useActions());

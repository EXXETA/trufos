import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useActions } from '@/state/helper/util';

interface ViewState {
  /** Whether the collection runner modal is open */
  isCollectionRunnerOpen: boolean;
  /** Whether the collection settings modal is open */
  isCollectionSettingsOpen: boolean;
  /** Whether the command palette is open */
  isCommandPaletteOpen: boolean;
  /** Whether the app settings modal is open */
  isAppSettingsOpen: boolean;
}

interface ViewActions {
  openCollectionRunner(): void;
  closeCollectionRunner(): void;
  openCollectionSettings(): void;
  closeCollectionSettings(): void;
  openCommandPalette(): void;
  closeCommandPalette(): void;
  openAppSettings(): void;
  closeAppSettings(): void;
}

export const useViewStore = create<ViewState & ViewActions>()(
  immer((set) => ({
    isCollectionRunnerOpen: false,
    isCollectionSettingsOpen: false,
    isCommandPaletteOpen: false,
    isAppSettingsOpen: false,

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

    openCommandPalette() {
      set((state) => {
        state.isCommandPaletteOpen = true;
      });
    },

    closeCommandPalette() {
      set((state) => {
        state.isCommandPaletteOpen = false;
      });
    },

    openAppSettings() {
      set((state) => {
        state.isAppSettingsOpen = true;
      });
    },

    closeAppSettings() {
      set((state) => {
        state.isAppSettingsOpen = false;
      });
    },
  }))
);

export const selectIsCollectionRunnerOpen = (state: ViewState) => state.isCollectionRunnerOpen;
export const selectIsCollectionSettingsOpen = (state: ViewState) => state.isCollectionSettingsOpen;
export const selectIsCommandPaletteOpen = (state: ViewState) => state.isCommandPaletteOpen;
export const selectIsAppSettingsOpen = (state: ViewState) => state.isAppSettingsOpen;
export const useViewActions = (): ViewActions => useViewStore(useActions());

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useActions } from '@/state/helper/util';
import type { CreatingItem } from '@/components/sidebar/SidebarRequestList/types';

interface ViewState {
  /** Whether the collection runner modal is open */
  isCollectionRunnerOpen: boolean;
  /** Whether the collection settings modal is open */
  isCollectionSettingsOpen: boolean;
  /** Whether the command palette is open */
  isCommandPaletteOpen: boolean;
  /** Whether the app settings modal is open */
  isAppSettingsOpen: boolean;
  /**
   * One-shot bridge slot: set by a source with no prop path to `Menubar.tsx`'s local
   * `creatingItem` state (e.g. the Command Palette) to request the sidebar's inline
   * create-item flow. `Menubar.tsx` consumes it and immediately clears it back to `null`.
   */
  pendingCreateItem: CreatingItem;
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
  /** Sets the pending create-item request; pass `null` to clear it. */
  requestCreateItem(item: CreatingItem): void;
}

export const useViewStore = create<ViewState & ViewActions>()(
  immer((set) => ({
    isCollectionRunnerOpen: false,
    isCollectionSettingsOpen: false,
    isCommandPaletteOpen: false,
    isAppSettingsOpen: false,
    pendingCreateItem: null,

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

    requestCreateItem(item) {
      set((state) => {
        state.pendingCreateItem = item;
      });
    },
  }))
);

export const selectIsCollectionRunnerOpen = (state: ViewState) => state.isCollectionRunnerOpen;
export const selectIsCollectionSettingsOpen = (state: ViewState) => state.isCollectionSettingsOpen;
export const selectIsCommandPaletteOpen = (state: ViewState) => state.isCommandPaletteOpen;
export const selectIsAppSettingsOpen = (state: ViewState) => state.isAppSettingsOpen;
export const selectPendingCreateItem = (state: ViewState) => state.pendingCreateItem;
export const useViewActions = (): ViewActions => useViewStore(useActions());

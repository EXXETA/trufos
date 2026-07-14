import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useActions } from '@/state/helper/util';

export type SidebarTab = 'requests' | 'history';

interface ViewState {
  /** Whether the collection runner modal is open */
  isCollectionRunnerOpen: boolean;
  /** Whether the collection settings modal is open */
  isCollectionSettingsOpen: boolean;
  /** The active tab of the sidebar (request list or history panel) */
  sidebarTab: SidebarTab;
}

interface ViewActions {
  openCollectionRunner(): void;
  closeCollectionRunner(): void;
  openCollectionSettings(): void;
  closeCollectionSettings(): void;
  setSidebarTab(tab: SidebarTab): void;
}

export const useViewStore = create<ViewState & ViewActions>()(
  immer((set) => ({
    isCollectionRunnerOpen: false,
    isCollectionSettingsOpen: false,
    sidebarTab: 'requests',

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

    setSidebarTab(tab: SidebarTab) {
      set((state) => {
        state.sidebarTab = tab;
      });
    },
  }))
);

export const selectIsCollectionRunnerOpen = (state: ViewState) => state.isCollectionRunnerOpen;
export const selectIsCollectionSettingsOpen = (state: ViewState) => state.isCollectionSettingsOpen;
export const selectSidebarTab = (state: ViewState) => state.sidebarTab;
export const useViewActions = (): ViewActions => useViewStore(useActions());

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useActions } from '@/state/helper/util';
import type { CreatingItem } from '@/components/sidebar/SidebarRequestList/types';
import type { TrufosId } from 'shim/objects/id';

/** What the sidebar lists: the requests of the collection or its request history. */
export type SidebarView = 'requests' | 'history';

interface ViewState {
  /** Whether the collection runner modal is open */
  isCollectionRunnerOpen: boolean;
  /** Whether the collection settings modal is open */
  isCollectionSettingsOpen: boolean;
  /** The folder whose settings modal is open, if any */
  folderSettingsId?: TrufosId;
  /** Whether the command palette is open */
  isCommandPaletteOpen: boolean;
  /** Whether the app settings modal is open */
  isAppSettingsOpen: boolean;
  /** What the sidebar lists */
  sidebarView: SidebarView;
  /**
   * One-shot bridge slot: set by a source with no prop path to `Menubar.tsx`'s local
   * `creatingItem` state (e.g. the Command Palette or the sidebar header) to request the
   * sidebar's inline create-item flow. `Menubar.tsx` consumes it and immediately clears it back
   * to `null`.
   */
  pendingCreateItem: CreatingItem;
}

interface ViewActions {
  openCollectionRunner(): void;
  closeCollectionRunner(): void;
  openCollectionSettings(): void;
  closeCollectionSettings(): void;
  openFolderSettings(id: TrufosId): void;
  closeFolderSettings(): void;
  openCommandPalette(): void;
  closeCommandPalette(): void;
  openAppSettings(): void;
  closeAppSettings(): void;
  setSidebarView(view: SidebarView): void;
  /**
   * Sets the pending create-item request; pass `null` to clear it. Shows the request tree, as the
   * item is created there.
   */
  requestCreateItem(item: CreatingItem): void;
}

export const useViewStore = create<ViewState & ViewActions>()(
  immer((set) => ({
    isCollectionRunnerOpen: false,
    isCollectionSettingsOpen: false,
    isCommandPaletteOpen: false,
    isAppSettingsOpen: false,
    sidebarView: 'requests',
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

    openFolderSettings(id) {
      set((state) => {
        state.folderSettingsId = id;
      });
    },

    closeFolderSettings() {
      set((state) => {
        state.folderSettingsId = undefined;
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

    setSidebarView(view) {
      set((state) => {
        state.sidebarView = view;
      });
    },

    requestCreateItem(item) {
      set((state) => {
        state.pendingCreateItem = item;
        if (item != null) state.sidebarView = 'requests';
      });
    },
  }))
);

export const selectIsCollectionRunnerOpen = (state: ViewState) => state.isCollectionRunnerOpen;
export const selectIsCollectionSettingsOpen = (state: ViewState) => state.isCollectionSettingsOpen;
export const selectFolderSettingsId = (state: ViewState) => state.folderSettingsId;
export const selectIsCommandPaletteOpen = (state: ViewState) => state.isCommandPaletteOpen;
export const selectIsAppSettingsOpen = (state: ViewState) => state.isAppSettingsOpen;
export const selectSidebarView = (state: ViewState): SidebarView => state.sidebarView;
export const selectPendingCreateItem = (state: ViewState) => state.pendingCreateItem;
export const useViewActions = (): ViewActions => useViewStore(useActions());

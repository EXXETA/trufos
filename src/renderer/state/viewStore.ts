import { useActions } from '@/state/helper/util';
import { type ViewState, useAppStore } from '@/state/collectionStore';

interface ViewActions {
  openCollectionRunner(): void;
  closeCollectionRunner(): void;
  openCollectionSettings(): void;
  closeCollectionSettings(): void;
}

type ViewStoreState = ViewState & ViewActions;

export const useViewStore = <T>(selector: (state: ViewStoreState) => T): T =>
  useAppStore((state) =>
    selector({
      isCollectionRunnerOpen: state.isCollectionRunnerOpen,
      isCollectionSettingsOpen: state.isCollectionSettingsOpen,
      openCollectionRunner: state.openCollectionRunner,
      closeCollectionRunner: state.closeCollectionRunner,
      openCollectionSettings: state.openCollectionSettings,
      closeCollectionSettings: state.closeCollectionSettings,
    })
  );

export const selectIsCollectionRunnerOpen = (state: ViewState) => state.isCollectionRunnerOpen;
export const selectIsCollectionSettingsOpen = (state: ViewState) => state.isCollectionSettingsOpen;
export const useViewActions = (): ViewActions => useViewStore(useActions());

import { CollectionStateActions } from '@/state/interface/CollectionStateActions';
import { useActions } from '@/state/helper/util';
import {
  type CollectionState,
  useAppStore,
  selectHeaders,
  selectQueryParams,
  selectRequest,
  selectFolder,
} from '@/state/appStore';

type CollectionStoreState = CollectionState & CollectionStateActions;

export const useCollectionStore = <T>(selector: (state: CollectionStoreState) => T): T =>
  useAppStore((state) => selector(state));

export const useCollectionActions = (): CollectionStateActions => useCollectionStore(useActions());

export { selectHeaders, selectQueryParams, selectRequest, selectFolder };

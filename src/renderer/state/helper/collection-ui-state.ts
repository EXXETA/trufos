import { z } from 'zod';
import { CollectionUiState, CollectionUiStateInput } from 'shim/collection-ui-state';
import { CollectionModel } from 'shim/collection-model';

/** How long the UI state has to stay unchanged before it is sent to main. */
export const UI_STATE_SAVE_DELAY_MS = 500;

/**
 * The {@link CollectionUiState} as the collection store holds it. Parsing decodes the stored
 * state, encoding turns the store's state back into it, dropping the store's other fields.
 */
export const StoreUiState = CollectionUiState.extend({
  openFolders: z.codec(CollectionUiState.shape.openFolders, z.set(z.string()), {
    decode: (ids) => new Set(ids),
    encode: (ids) => [...ids],
  }),
});
export type StoreUiState = z.output<typeof StoreUiState>;

/** The fields of the collection store that are its {@link StoreUiState}. */
export const STORE_UI_STATE_KEYS = StoreUiState.keyof().options;

/**
 * Decodes the UI state stored for a collection, pruned to the IDs that exist in its model.
 * @param uiState the stored UI state. The defaults if there is none.
 */
export function restoreUiState(model: CollectionModel, uiState?: CollectionUiState): StoreUiState {
  const { selectedRequestId, openFolders, ...rest } = StoreUiState.parse(uiState ?? {});
  return {
    ...rest,
    selectedRequestId:
      selectedRequestId != null && model.requests.has(selectedRequestId)
        ? selectedRequestId
        : undefined,
    openFolders: new Set([...openFolders].filter((id) => model.folders.has(id))),
  };
}

/** Sends the UI state of collections to main, debounced. */
export interface UiStateSender {
  /** Sends the UI state of the collection once it did not change for a while. */
  schedule(dirPath: string, uiState: CollectionUiStateInput): void;
  /** Sends the scheduled UI state right away. Failures are only logged. */
  flush(): Promise<void>;
}

/**
 * Creates a {@link UiStateSender}. Only the latest UI state is sent. If the UI state of another
 * collection is scheduled, the pending one is sent first, so it is not lost.
 * @param send sends the UI state of a collection to main
 */
export function createUiStateSender(
  send: (dirPath: string, uiState: CollectionUiStateInput) => Promise<void>
): UiStateSender {
  let pending: { dirPath: string; uiState: CollectionUiStateInput } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = async () => {
    clearTimeout(timer);
    const sent = pending;
    pending = undefined;
    if (sent == null) return;
    try {
      await send(sent.dirPath, sent.uiState);
    } catch (error) {
      console.warn('Could not store the UI state of collection', sent.dirPath, error);
    }
  };

  return {
    schedule(dirPath, uiState) {
      if (pending != null && pending.dirPath !== dirPath) void flush();
      pending = { dirPath, uiState };
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), UI_STATE_SAVE_DELAY_MS);
    },
    flush,
  };
}

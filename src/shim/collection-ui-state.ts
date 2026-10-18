import { z } from 'zod';
import { SortMode } from 'shim/sort-mode';
import { ScriptType } from 'shim/scripting';

/**
 * The UI state of a collection, e.g. its open folders, that is restored when the collection is
 * opened again. The renderer owns it; main stores it with the open collection. IDs in it may no
 * longer exist, so the renderer prunes it against the collection when it restores it.
 */
export const CollectionUiState = z.object({
  /** The request open in the editor. */
  selectedRequestId: z.string().optional(),
  /** The folders open in the sidebar. */
  openFolders: z.array(z.string()).default(() => []),
  sortMode: z.enum(SortMode).default(SortMode.DEFAULT),
  currentScriptType: z.enum(ScriptType).default(ScriptType.PRE_REQUEST),
});
export type CollectionUiState = z.infer<typeof CollectionUiState>;
/** A {@link CollectionUiState} before it is parsed, e.g. as it is sent to main. */
export type CollectionUiStateInput = z.input<typeof CollectionUiState>;

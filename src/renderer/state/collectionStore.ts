import { createContext, useContext } from 'react';
import { type StoreApi, useStore } from 'zustand';
import { createStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { type Draft, produce } from 'immer';
import { RendererEventService } from '@/services/event/renderer-event-service';
import {
  getIndexAfter,
  getTopLevelSelectedItems,
  isWithinGroup,
  setRequestTextBody,
  setScriptContent,
} from '@/state/helper/collectionUtil';
import { useActions } from '@/state/helper/util';
import { CollectionStateActions } from '@/state/interface/CollectionStateActions';
import { CollectionReplica, FetchSnapshot, SendCommand } from '@/state/collection-replica';
import {
  cancelModelEdits,
  createModelsForRequest,
  disposeModelsForRequest,
  flushModelEdits,
  ModelPersistence,
} from '@/lib/monaco/models';
import { showError } from '@/error/errorHandler';
import { applyAuthorizationChange } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/AuthorizationTab/forms';
import {
  CollectionCommand,
  CollectionInfo,
  CollectionModel,
  CommandType,
  FolderInfo,
  getDescendantIds,
  isSelfOrDescendant,
  RequestChanges,
} from 'shim/collection-model';
import { AuthorizationInformation } from 'shim/objects/auth';
import { FormDataBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { TrufosId } from 'shim/objects/id';
import { RequestMethod } from 'shim/objects/request-method';
import { parseUrl } from 'shim/objects/url';
import { ScriptType } from 'shim/scripting';
import { SortMode } from '@/components/sidebar/SidebarRequestList/treeUtilities';

const eventService = RendererEventService.instance;

/** The fields of the {@link CollectionModel} that the store mirrors. */
type ModelState = Omit<CollectionModel, 'version'>;

/** Purely visual state that is not part of the collection. */
interface UiState {
  /** The ID of the currently selected request */
  selectedRequestId?: TrufosRequest['id'];

  /** A set of folder IDs that are currently open in the sidebar */
  openFolders: Set<FolderInfo['id']>;

  /** A set of request/folder IDs currently multi-selected in the sidebar */
  selectedIds: Set<TrufosRequest['id'] | FolderInfo['id']>;

  /** The currently active script type in the script editor */
  currentScriptType: ScriptType;

  /** The currently active sort mode for the sidebar */
  sortMode: SortMode;

  /** Whether a bulk delete/duplicate is currently in flight (guards against concurrent runs) */
  isBulkActionRunning: boolean;
}

/**
 * The state of the collection store: a read-only mirror of the {@link CollectionReplica}'s model
 * (the collection including its variables and environments, folders, requests and their order),
 * plus UI state.
 */
export type CollectionState = ModelState & UiState;

export type CollectionStore = StoreApi<CollectionState & CollectionStateActions>;

// Context for the collection store
const CollectionStoreContext = createContext<CollectionStore | null>(null);

export const CollectionStoreProvider = CollectionStoreContext.Provider;

const EMPTY_CHILD_IDS: readonly TrufosId[] = Object.freeze([]);

function selectModelState(model: CollectionModel): ModelState {
  const { collection, selectedEnvironmentKey, folders, requests, savedRequests, childIds } = model;
  return { collection, selectedEnvironmentKey, folders, requests, savedRequests, childIds };
}

/** The fields of a request that an `editRequest` command can change. */
const EDITABLE_REQUEST_FIELDS = RequestChanges.keyof().options;

/** Sets a field of request changes, see {@link EDITABLE_REQUEST_FIELDS}. */
function setChange<K extends keyof RequestChanges>(
  changes: RequestChanges,
  field: K,
  value: RequestChanges[K]
) {
  changes[field] = value;
}

/**
 * Applies an Immer recipe to a request and returns what an `editRequest` command has to send: the
 * editable fields whose reference changed. A removed authorization is sent as `null`.
 * @returns the changes, or undefined if the recipe changed no editable field
 */
function getRequestChanges(
  request: TrufosRequest,
  recipe: (draft: Draft<TrufosRequest>) => void
): RequestChanges | undefined {
  const edited = produce(request, recipe);
  if (edited === request) return undefined;
  const changes: RequestChanges = {};
  for (const field of EDITABLE_REQUEST_FIELDS) {
    if (edited[field] !== request[field]) setChange(changes, field, edited[field] ?? null);
  }
  return Object.keys(changes).length === 0 ? undefined : changes;
}

function randomTitle() {
  return (Math.random() + 1).toString(36).substring(7);
}

/** A collection store together with the replica it mirrors. */
export interface CollectionStoreWithReplica {
  store: CollectionStore;
  replica: CollectionReplica;
}

/**
 * Creates the collection store and the {@link CollectionReplica} for the given snapshot. The store
 * follows every change of the replica's model and sends every change of the collection to the main
 * process as a command.
 */
export const createCollectionStore = (
  snapshot: CollectionModel,
  send: SendCommand,
  fetchSnapshot: FetchSnapshot
): CollectionStoreWithReplica => {
  console.debug('Creating collection store with collection', snapshot.collection.id);
  // the replica only calls back after the store below was created
  const replica = new CollectionReplica(snapshot, send, fetchSnapshot, (model) =>
    syncWithModel(store, model)
  );

  /** Sends a command. Rejects instead of throwing if it cannot be applied. */
  const dispatch = async (command: CollectionCommand) => replica.dispatch(command);

  /** Sends a command and shows an error if it fails, for actions that do not return a promise. */
  const dispatchAndForget = (command: CollectionCommand) => {
    dispatch(command).catch((error) => showError('Could not change the collection', error));
  };

  /** Changes the given request with an Immer recipe, see {@link getRequestChanges}. */
  const editRequest = (request: TrufosRequest, recipe: (draft: Draft<TrufosRequest>) => void) => {
    const changes = getRequestChanges(request, recipe);
    if (changes != null) {
      dispatchAndForget({ type: CommandType.EDIT_REQUEST, id: request.id, changes });
    }
  };

  /** Changes the selected request with an Immer recipe, see {@link editRequest}. */
  const editSelectedRequest = (recipe: (draft: Draft<TrufosRequest>) => void) => {
    const request = selectRequest(store.getState());
    if (request != null) editRequest(request, recipe);
  };

  /** Changes the form data fields of the selected request if it has a form data body. */
  const editFormDataFields = (recipe: (fields: Draft<FormDataBody['fields']>) => void) =>
    editSelectedRequest(({ body }) => {
      if (body.type === RequestBodyType.FORM_DATA) recipe(body.fields);
    });

  /**
   * Drops the editor changes of the given request or folder and its descendants, and deselects
   * the selected request if it is one of them. Used right before it is deleted.
   */
  const forgetItem = (id: TrufosId) => {
    const model = replica.model;
    for (const descendantId of [id, ...getDescendantIds(model, id)]) {
      cancelModelEdits(descendantId);
    }
    const { selectedRequestId, setSelectedRequest } = store.getState();
    if (selectedRequestId != null && isSelfOrDescendant(model, selectedRequestId, id)) {
      void setSelectedRequest(undefined);
    }
  };

  /** Copies a request or folder. Pending editor changes must be flushed before. */
  const copyItem = async (id: TrufosId) => {
    const ids = [id, ...getDescendantIds(replica.model, id)];
    const idMap = Object.fromEntries(ids.map((sourceId) => [sourceId, crypto.randomUUID()]));
    await dispatch({ type: CommandType.COPY, id, idMap });
  };

  const store = createStore<CollectionState & CollectionStateActions>()(
    immer((set, get) => ({
      ...selectModelState(replica.model),
      openFolders: new Set(),
      selectedIds: new Set(),
      currentScriptType: ScriptType.PRE_REQUEST,
      sortMode: SortMode.DEFAULT,
      isBulkActionRunning: false,

      changeCollection: async (dirPath) => {
        await get().setSelectedRequest(undefined);
        console.info('Opening collection at', dirPath);
        await eventService.openCollection(dirPath);
      },

      addNewRequest: async (title, parentId) => {
        const collectionId = get().collection.id;
        const request: TrufosRequest = {
          id: crypto.randomUUID(),
          parentId: parentId ?? collectionId,
          type: 'request',
          lastModified: Date.now(),
          title: title ?? randomTitle(),
          url: parseUrl('http://'),
          method: RequestMethod.GET,
          headers: [],
          body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
          draft: true,
        };
        await dispatch({ type: CommandType.CREATE_REQUEST, request });
        console.info('Created new request with ID', request.id);

        // Keep parent folder open if item was added to folder
        if (request.parentId !== collectionId) {
          get().setFolderOpen(request.parentId);
        }
        void get().setSelectedRequest(request.id);
      },

      updateRequest: ({ auth, ...changes }) =>
        editSelectedRequest((request) => {
          Object.assign(request, changes);
          if (auth === null) delete request.auth;
          else if (auth !== undefined) request.auth = auth;
        }),

      setRequestBody: (body) =>
        editSelectedRequest((request) => {
          request.body = body;
        }),

      setRequestBodyMimeType: (mimeType) =>
        editSelectedRequest(({ body }) => {
          switch (body.type) {
            case RequestBodyType.TEXT:
              // text bodies always have a mime type
              if (mimeType != null) body.mimeType = mimeType;
              return;
            case RequestBodyType.FILE:
              body.mimeType = mimeType;
              return;
            default:
              // form data bodies don't have a mime type
              return;
          }
        }),

      setSelectedRequest: (id) => {
        console.debug('Setting selected request to', id);
        const { selectedRequestId, requests } = get();
        if (selectedRequestId === id) return Promise.resolve();
        if (id != null && !requests.has(id)) {
          console.warn('Request with ID', id, 'not found');
          id = undefined;
        }

        // The outgoing request's editor changes are read synchronously, so its models can be
        // disposed right away.
        let flushed = Promise.resolve();
        if (selectedRequestId != null) {
          flushed = flushModelEdits(selectedRequestId);
          flushed.catch((error) => showError('Could not save the request', error));
          disposeModelsForRequest(selectedRequestId);
        }

        // Create models for the incoming request synchronously so they are
        // available by the time the next render reads them.
        if (id != null) {
          createModelsForRequest(id);
        }

        set((state) => {
          if (id != null) {
            let parentId = state.requests.get(id)!.parentId;
            while (parentId !== state.collection.id) {
              state.openFolders.add(parentId);
              const folder = state.folders.get(parentId);
              if (folder == null) break;
              parentId = folder.parentId;
            }
          }
          state.selectedRequestId = id;
        });
        return flushed;
      },

      setCurrentScriptType: (type) => {
        set({ currentScriptType: type });
      },

      setSortMode: (mode) => {
        set({ sortMode: mode });
      },

      toggleItemSelected: (id) => {
        set((state) => {
          if (state.selectedIds.has(id)) {
            state.selectedIds.delete(id);
          } else {
            state.selectedIds.add(id);
          }
        });
      },

      setSelection: (ids) => {
        set((state) => {
          state.selectedIds = new Set(ids);
        });
      },

      addToSelection: (ids) => {
        set({ selectedIds: get().selectedIds.union(new Set(ids)) });
      },

      clearSelection: () => {
        set((state) => {
          state.selectedIds = new Set();
        });
      },

      deleteSelectedItems: async () => {
        const { selectedIds, requests, folders } = get();
        const items = getTopLevelSelectedItems(selectedIds, requests, folders);
        await runBulk(set, get, async () => {
          for (const item of items) {
            forgetItem(item.id);
            await dispatch({ type: CommandType.DELETE, id: item.id });
          }
        });
      },

      duplicateSelectedItems: async () => {
        const { selectedIds, requests, folders } = get();
        const items = getTopLevelSelectedItems(selectedIds, requests, folders);
        await runBulk(set, get, async () => {
          // main copies the body and script files, so they must contain the latest editor changes
          await flushModelEdits();
          for (const item of items) {
            await copyItem(item.id);
          }
        });
      },

      deleteRequest: async (id) => {
        forgetItem(id);
        await dispatch({ type: CommandType.DELETE, id });
      },

      discardChanges: async () => {
        const request = selectRequest(get());
        if (request == null) return;
        cancelModelEdits(request.id);
        await dispatch({ type: CommandType.DISCARD_REQUEST, id: request.id });

        // a request that was never saved is gone now; otherwise reload its saved editor content
        const restored = replica.model.requests.get(request.id);
        if (restored == null || get().selectedRequestId !== request.id) return;
        await setRequestTextBody(request.id, restored);
        for (const scriptType of Object.values(ScriptType)) {
          await setScriptContent(request.id, restored, scriptType);
        }
      },

      saveRequest: async (id) => {
        await flushModelEdits(id);
        await dispatch({ type: CommandType.SAVE_REQUEST, id });
      },

      renameRequest: async (id, title) => {
        await dispatch({ type: CommandType.RENAME, id, title });
      },

      copyRequest: async (id) => {
        await flushModelEdits();
        await copyItem(id);
      },

      addHeader: () =>
        editSelectedRequest(({ headers }) => {
          headers.push({ key: '', value: '', isActive: true });
        }),

      updateHeader: (index, updatedHeader) =>
        editSelectedRequest(({ headers }) => {
          if (headers[index] != null) Object.assign(headers[index], updatedHeader);
        }),

      deleteHeader: (index) =>
        editSelectedRequest(({ headers }) => {
          headers.splice(index, 1);
        }),

      clearHeaders: () =>
        editSelectedRequest((request) => {
          request.headers = [];
        }),

      addQueryParam: () =>
        editSelectedRequest(({ url }) => {
          url.query.push({ key: '', value: '', isActive: true });
        }),

      updateQueryParam: (index, updatedParam) =>
        editSelectedRequest(({ url }) => {
          if (url.query[index] != null) Object.assign(url.query[index], updatedParam);
        }),

      deleteQueryParam: (index) =>
        editSelectedRequest(({ url }) => {
          url.query.splice(index, 1);
        }),

      clearQueryParams: () =>
        editSelectedRequest(({ url }) => {
          url.query = [];
        }),

      setQueryParamActive: (index, isActive) =>
        editSelectedRequest(({ url }) => {
          const param = url.query[index];
          if (param != null) param.isActive = isActive ?? !param.isActive;
        }),

      addFormDataField: () =>
        editFormDataFields((fields) => {
          fields.push({
            key: '',
            isActive: true,
            value: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
          });
        }),

      updateFormDataField: (index, updatedField) =>
        editFormDataFields((fields) => {
          if (fields[index] != null) Object.assign(fields[index], updatedField);
        }),

      deleteFormDataField: (index) =>
        editFormDataFields((fields) => {
          fields.splice(index, 1);
        }),

      addNewFolder: async (title?, parentId?) => {
        const collectionId = get().collection.id;
        const folder: FolderInfo = {
          id: crypto.randomUUID(),
          parentId: parentId ?? collectionId,
          type: 'folder',
          title: title ?? randomTitle(),
          lastModified: Date.now(),
        };
        await dispatch({ type: CommandType.CREATE_FOLDER, folder });
        if (folder.parentId !== collectionId) {
          get().setFolderOpen(folder.parentId);
        }
      },

      deleteFolder: async (id) => {
        console.info('Deleting folder', id);
        forgetItem(id);
        await dispatch({ type: CommandType.DELETE, id });
      },

      renameFolder: async (id, title) => {
        await dispatch({ type: CommandType.RENAME, id, title });
      },

      copyFolder: async (id) => {
        await flushModelEdits();
        await copyItem(id);
      },

      isFolderOpen: (id) => get().openFolders.has(id),

      setFolderOpen: (id) => {
        set((state) => {
          state.openFolders.add(id);
        });
      },

      setFolderClose: (id) => {
        set((state) => {
          state.openFolders.delete(id);
        });
      },

      updateAuthorization: (request, updatedFields) => {
        const current = selectRequest(get(), request.id);
        if (current == null) return;

        let auth: AuthorizationInformation | undefined;
        if (updatedFields != null) {
          try {
            auth = applyAuthorizationChange(current.auth, updatedFields);
          } catch (error) {
            console.error('Ignoring an invalid authorization change', error);
            return;
          }
        }
        editRequest(current, (draft) => {
          if (auth == null) delete draft.auth;
          else draft.auth = auth;
        });
      },

      updateCollection: async (changes) => {
        await dispatch({ type: CommandType.UPDATE_COLLECTION, changes });
      },

      selectEnvironment: async (key) => {
        await dispatch({ type: CommandType.SELECT_ENVIRONMENT, key });
      },

      closeCollection: async (dirPath) => {
        const { collection, setSelectedRequest } = get();
        const targetPath = dirPath ?? collection.dirPath;
        if (targetPath === collection.dirPath) {
          await setSelectedRequest(undefined);
        }
        console.info('Closing collection at', targetPath);
        await eventService.closeCollection(targetPath);
      },

      moveItem: async (itemId, newParentId, newIndex) => {
        console.info(`Moving item ${itemId} to parent ${newParentId} at position ${newIndex}`);
        const { requests, folders, setFolderOpen } = get();
        const item = requests.get(itemId) ?? folders.get(itemId);
        const moved = dispatch({
          type: CommandType.MOVE,
          id: itemId,
          parentId: newParentId,
          index: newIndex,
        });
        // Open the target folder so the moved item is visible
        if (item != null && item.parentId !== newParentId && folders.has(newParentId)) {
          setFolderOpen(newParentId);
        }
        await moved;
      },

      moveItemsAfter: async (afterId, ids) => {
        // Every id lands in the anchor's parent, so validating that parent once up front is
        // enough to guarantee no group member gets nested inside itself (I20).
        const initial = get();
        const anchor = selectRequest(initial, afterId) ?? selectFolder(initial, afterId);
        if (anchor == null) {
          throw new Error(`Cannot move items after ${afterId}: item not found`);
        }
        if (isWithinGroup(anchor.parentId, new Set(ids), initial.requests, initial.folders)) {
          throw new Error(
            `Cannot move items after ${afterId}: its parent ${anchor.parentId} is one of the moved items or inside one`
          );
        }

        let prevId = afterId;
        for (const id of ids) {
          // Re-read state on every iteration: each move changes the order and may change an
          // item's parentId, so no index or parent can be precomputed up front.
          const state = get();
          const prev = selectRequest(state, prevId) ?? selectFolder(state, prevId);
          if (prev == null) {
            throw new Error(`Cannot move ${id} after ${prevId}: item not found`);
          }
          const index = getIndexAfter(selectChildIds(state, prev.parentId), id, prevId);
          await get().moveItem(id, prev.parentId, index);
          prevId = id;
        }
      },
    }))
  );

  return { store, replica };
};

/**
 * Takes over the model into the store. If another collection was opened, the UI state is reset;
 * otherwise it is pruned to IDs that still exist.
 */
function syncWithModel(store: CollectionStore, model: CollectionModel) {
  const state = store.getState();
  const isNewCollection =
    state.collection.id !== model.collection.id ||
    state.collection.dirPath !== model.collection.dirPath;
  const { selectedRequestId } = state;

  if (selectedRequestId != null && (isNewCollection || !model.requests.has(selectedRequestId))) {
    // the request was deleted or discarded, its editor changes must not recreate it
    disposeModelsForRequest(selectedRequestId);
  }

  if (isNewCollection) {
    store.setState({
      ...selectModelState(model),
      selectedRequestId: undefined,
      openFolders: new Set(),
      selectedIds: new Set(),
    });
    console.info('Opened collection', model.collection.id);
    return;
  }

  store.setState({
    ...selectModelState(model),
    selectedRequestId:
      selectedRequestId != null && model.requests.has(selectedRequestId)
        ? selectedRequestId
        : undefined,
    openFolders: retainExisting(state.openFolders, (id) => model.folders.has(id)),
    selectedIds: retainExisting(
      state.selectedIds,
      (id) => model.requests.has(id) || model.folders.has(id)
    ),
  });
}

/** Returns the set itself if all IDs exist, so selectors stay stable, or a pruned copy. */
function retainExisting(ids: Set<TrufosId>, exists: (id: TrufosId) => boolean): Set<TrufosId> {
  for (const id of ids) {
    if (!exists(id)) return new Set([...ids].filter(exists));
  }
  return ids;
}

/**
 * Persists the content of the editor models of the given replica's requests as commands.
 */
export function createModelPersistence(replica: CollectionReplica): ModelPersistence {
  return {
    setTextBody: async (id, text) =>
      replica.dispatch({ type: CommandType.SET_TEXT_BODY, id, text }),
    setScript: async (id, scriptType, text) =>
      replica.dispatch({ type: CommandType.SET_SCRIPT, id, scriptType, text }),
    markDraft: async (id) => {
      const request = replica.model.requests.get(id);
      if (request != null && !request.draft) {
        await replica.dispatch({ type: CommandType.EDIT_REQUEST, id, changes: {} });
      }
    },
  };
}

// Hook to access the collection store from context
export const useCollectionStore = <T>(
  selector: (state: CollectionState & CollectionStateActions) => T
): T => {
  const store = useContext(CollectionStoreContext);
  if (!store) {
    throw new Error('useCollectionStore must be used within CollectionStoreProvider');
  }
  return useStore(store, selector);
};

export const useCollectionActions = (): CollectionStateActions => useCollectionStore(useActions());

// Export context for the provider to access the raw store
export { CollectionStoreContext };

/**
 * Runs a bulk request/folder action (delete or duplicate). If another bulk action is already in
 * flight (`isBulkActionRunning`), this call is a no-op; otherwise the flag is set synchronously
 * before the first `await`, so the check-and-set is atomic with respect to the event loop and e.g.
 * a fast double-click can't start a second concurrent run over the same selection. The selection
 * is cleared and the flag reset in a `finally`, so a failure mid-loop still leaves the state
 * consistent; the exception still propagates, no rollback is attempted.
 */
const runBulk = async (
  set: (updater: (state: CollectionState) => void) => void,
  get: () => CollectionState & CollectionStateActions,
  action: () => Promise<void>
): Promise<void> => {
  if (get().isBulkActionRunning) return;
  set((state) => {
    state.isBulkActionRunning = true;
  });

  try {
    await action();
  } finally {
    get().clearSelection();
    set((state) => {
      state.isBulkActionRunning = false;
    });
  }
};

export const selectHeaders = (state: CollectionState) => selectRequest(state)!.headers;
export const selectQueryParams = (state: CollectionState) => selectRequest(state)!.url.query;

export const selectRequest = (
  state: CollectionState,
  requestId?: TrufosRequest['id']
): TrufosRequest | undefined => {
  const id = requestId ?? state.selectedRequestId;
  return id != null ? state.requests.get(id) : undefined;
};

export const selectFolder = (
  state: CollectionState,
  folderId: FolderInfo['id']
): FolderInfo | undefined => state.folders.get(folderId);

/** Returns the ordered child IDs of the collection or a folder. Empty if it has none. */
export const selectChildIds = (state: CollectionState, parentId: TrufosId): readonly TrufosId[] =>
  state.childIds.get(parentId) ?? EMPTY_CHILD_IDS;

/** Returns the current collection, without its children. */
export const selectCollection = (state: CollectionState): CollectionInfo => state.collection;

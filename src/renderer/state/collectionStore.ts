import { createContext, useContext, useMemo } from 'react';
import { type StoreApi, useStore } from 'zustand';
import { createStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { type Draft, produce } from 'immer';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { HttpService } from '@/services/http/http-service';
import { loadEditorContent } from '@/state/helper/collectionUtil';
import { applyAuthorizationChange } from '@/state/helper/authorization';
import { useActions } from '@/state/helper/util';
import { CollectionStateActions } from '@/state/interface/CollectionStateActions';
import { CollectionState, FetchSnapshot, SendCommand } from '@/state/collection-state';
import {
  cancelModelEdits,
  createModelsForRequest,
  disposeModelsForRequest,
  flushModelEdits,
  ModelPersistence,
  suspendModelEdits,
} from '@/lib/monaco/models';
import { showError } from '@/error/errorHandler';
import {
  CollectionCommand,
  CollectionModel,
  CollectionTree,
  CommandType,
  FolderInfo,
  getAncestorIds,
  getDescendantIds,
  getTopLevelIds,
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
const httpService = HttpService.instance;

/** The fields of the {@link CollectionModel} that the store mirrors. */
type ModelState = Omit<CollectionModel, 'version'>;

/** Purely visual state that is not part of the collection. */
interface UiState {
  /** The ID of the currently selected request */
  selectedRequestId?: TrufosId;

  /** A set of folder IDs that are currently open in the sidebar */
  openFolders: Set<TrufosId>;

  /** A set of request/folder IDs currently multi-selected in the sidebar */
  selectedIds: Set<TrufosId>;

  /** The currently active script type in the script editor */
  currentScriptType: ScriptType;

  /** The currently active sort mode for the sidebar */
  sortMode: SortMode;
}

/**
 * The state of the collection store: a read-only mirror of the {@link CollectionState}'s model
 * (the collection including its variables and environments, folders, requests and their order),
 * plus UI state.
 */
export type CollectionStoreState = ModelState & UiState;

export type CollectionStore = StoreApi<CollectionStoreState & CollectionStateActions>;

// Context for the collection store
const CollectionStoreContext = createContext<CollectionStore | null>(null);

export const CollectionStoreProvider = CollectionStoreContext.Provider;

function selectModelState(model: CollectionModel): ModelState {
  const { collection, selectedEnvironmentKey, folders, requests, savedRequests, childIds } = model;
  return { collection, selectedEnvironmentKey, folders, requests, savedRequests, childIds };
}

/** The fields of a request that are edited with an Immer recipe, see `editSelectedRequest`. */
type RecipeField = 'headers' | 'url' | 'body';

function randomTitle() {
  return (Math.random() + 1).toString(36).substring(7);
}

/**
 * Shows the error of a failed store action.
 * @returns the action, resolving to false instead of rejecting if it failed
 */
function reported<A extends unknown[]>(
  message: string,
  action: (...args: A) => Promise<void>
): (...args: A) => Promise<boolean> {
  return async (...args) => {
    try {
      await action(...args);
      return true;
    } catch (error) {
      showError(message, error);
      return false;
    }
  };
}

/** A collection store together with the {@link CollectionState} it mirrors. */
export interface CollectionStoreWithState {
  store: CollectionStore;
  collectionState: CollectionState;
}

/**
 * Creates the collection store and the {@link CollectionState} for the given snapshot. The store
 * follows every change of the state's model and sends every change of the collection to the main
 * process as a command.
 *
 * Async actions show their errors themselves, see {@link reported}; sync actions show the errors
 * of the commands they send.
 */
export const createCollectionStore = (
  snapshot: CollectionModel,
  send: SendCommand,
  fetchSnapshot: FetchSnapshot
): CollectionStoreWithState => {
  console.debug('Creating collection store with collection', snapshot.collection.id);
  // the state only calls back after the store below was created
  const collectionState = new CollectionState(snapshot, send, fetchSnapshot, (model) =>
    syncWithModel(store, model)
  );
  const get = (): CollectionStoreState & CollectionStateActions => store.getState();

  /** Sends a command. Rejects instead of throwing if it cannot be applied. */
  const dispatch = async (command: CollectionCommand) => collectionState.dispatch(command);

  /** Sends a command and shows an error if it fails, for actions that do not return a promise. */
  const dispatchAndForget = (command: CollectionCommand) => {
    dispatch(command).catch((error) => showError('Could not change the collection', error));
  };

  /** Sends the content of the editor models as commands. */
  const modelPersistence: ModelPersistence = {
    setTextBody: (id, text) => dispatch({ type: CommandType.SET_TEXT_BODY, id, text }),
    setScript: (id, scriptType, text) =>
      dispatch({ type: CommandType.SET_SCRIPT, id, scriptType, text }),
    markDraft: async (id) => {
      const request = get().requests.get(id);
      if (request != null && !request.draft) await dispatch({ type: CommandType.CREATE_DRAFT, id });
    },
    editFailed: (id, model, error) => {
      showError('Could not save the editor change', error);
      // the editor shows text that is not persisted, so it goes back to what is
      const request = get().requests.get(id);
      if (request != null && get().selectedRequestId === id) {
        loadEditorContent(request, model).catch((e) => showError('Could not load the request', e));
      }
    },
  };

  /** Changes the selected request. */
  const editRequest = (changes: RequestChanges) => {
    const request = selectRequest(get());
    if (request != null) {
      dispatchAndForget({ type: CommandType.EDIT_REQUEST, id: request.id, changes });
    }
  };

  /**
   * Changes a field of the selected request with an Immer recipe. Nothing is sent if the recipe
   * changes nothing.
   */
  const editSelectedRequest = <K extends RecipeField>(
    field: K,
    recipe: (draft: Draft<TrufosRequest[K]>) => void
  ) => {
    const request = selectRequest(get());
    if (request == null) return;
    const value = produce(request[field], recipe);
    if (value === request[field]) return;
    const changes: RequestChanges = {};
    changes[field] = value;
    editRequest(changes);
  };

  /** Changes the form data fields of the selected request if it has a form data body. */
  const editFormDataFields = (recipe: (fields: Draft<FormDataBody['fields']>) => void) =>
    editSelectedRequest('body', (body) => {
      if (body.type === RequestBodyType.FORM_DATA) recipe(body.fields);
    });

  /**
   * Selects a request, see {@link CollectionStateActions.setSelectedRequest}. Errors are not
   * shown, so actions that build on it can show their own.
   */
  const changeSelectedRequest = (id?: TrufosId): Promise<void> => {
    console.debug('Setting selected request to', id);
    const { selectedRequestId, requests } = get();
    if (selectedRequestId === id) return Promise.resolve();
    const request = id != null ? requests.get(id) : undefined;
    if (id != null && request == null) console.warn('Request with ID', id, 'not found');

    // The outgoing request's editor changes are read synchronously, so its models can be
    // disposed right away.
    let flushed = Promise.resolve();
    if (selectedRequestId != null) {
      flushed = flushModelEdits(selectedRequestId);
      disposeModelsForRequest(selectedRequestId);
    }

    // The models of the incoming request are created synchronously, so they are available by
    // the time the next render reads them.
    if (request != null) {
      createModelsForRequest(request.id, modelPersistence);
      loadEditorContent(request).catch((error) => showError('Could not load the request', error));
    }

    const ancestorIds = request != null ? getAncestorIds(get(), request.id) : [];
    store.setState((state) => {
      for (const ancestorId of ancestorIds) state.openFolders.add(ancestorId);
      state.selectedRequestId = request?.id;
    });
    return flushed;
  };

  /** Removes the top-level items of the multi-selection from it and returns their IDs. */
  const takeTopLevelSelection = (): TrufosId[] => {
    const ids = getTopLevelIds(get(), get().selectedIds);
    get().clearSelection();
    return ids;
  };

  /**
   * Deletes requests and folders. If the selected request is one of them, it is deselected when the
   * store syncs with the model, see {@link syncWithModel}. Its editor changes are sent first, so
   * nothing is lost if main rejects the delete; main applies them before the delete, in order.
   */
  const deleteItems = async (ids: TrufosId[]) => {
    const deletedIds = ids.flatMap((id) => [id, ...getDescendantIds(get(), id)]);
    const flushed = deletedIds.map((id) => flushModelEdits(id));
    await Promise.all([...flushed, dispatch({ type: CommandType.DELETE, ids })]);
  };

  /** Copies requests and folders. Main copies their files, so the editor changes are sent first. */
  const copyItems = async (ids: TrufosId[]) => {
    await flushModelEdits();
    const sourceIds = ids.flatMap((id) => [id, ...getDescendantIds(get(), id)]);
    const idMap = Object.fromEntries(sourceIds.map((id) => [id, crypto.randomUUID()]));
    await dispatch({ type: CommandType.COPY, ids, idMap });
  };

  /** Opens the folder with the given ID in the sidebar, so an item created or moved into it is visible. */
  const revealFolder = (id: TrufosId) => {
    const { folders, setFolderOpen } = get();
    if (folders.has(id)) setFolderOpen(id);
  };

  const store = createStore<CollectionStoreState & CollectionStateActions>()(
    immer((set) => ({
      ...selectModelState(snapshot),
      openFolders: new Set(),
      selectedIds: new Set(),
      currentScriptType: ScriptType.PRE_REQUEST,
      sortMode: SortMode.DEFAULT,

      changeCollection: reported('Could not open the collection', async (dirPath) => {
        await changeSelectedRequest(undefined);
        console.info('Opening collection at', dirPath);
        await eventService.openCollection(dirPath);
      }),

      createCollection: reported('Could not create the collection', async (dirPath, title) => {
        await changeSelectedRequest(undefined);
        console.info('Creating collection at', dirPath);
        await eventService.createCollection(dirPath, title);
      }),

      addNewRequest: reported('Could not create the request', async (title, parentId) => {
        const request: TrufosRequest = {
          id: crypto.randomUUID(),
          parentId: parentId ?? get().collection.id,
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
        revealFolder(request.parentId);
        void get().setSelectedRequest(request.id);
      }),

      updateRequest: editRequest,

      setRequestBody: (body) => editRequest({ body }),

      setRequestBodyMimeType: (mimeType) =>
        editSelectedRequest('body', (body) => {
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

      setSelectedRequest: reported('Could not save the request', changeSelectedRequest),

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

      // the selection is taken synchronously, so a second call while one runs has nothing to do
      deleteSelectedItems: reported('Could not delete the items', async () => {
        const ids = takeTopLevelSelection();
        if (ids.length > 0) await deleteItems(ids);
      }),

      duplicateSelectedItems: reported('Could not duplicate the items', async () => {
        const ids = takeTopLevelSelection();
        if (ids.length > 0) await copyItems(ids);
      }),

      deleteItem: reported('Could not delete the item', (id) => deleteItems([id])),

      renameItem: reported('Could not rename the item', async (id, title) => {
        await dispatch({ type: CommandType.RENAME, id, title });
      }),

      copyItem: reported('Could not copy the item', (id) => copyItems([id])),

      discardChanges: reported('Could not discard the changes', async () => {
        const request = selectRequest(get());
        if (request == null) return;
        // text typed while main discards is replaced by the saved content, so it is not an edit
        cancelModelEdits(request.id);
        const resume = suspendModelEdits(request.id);
        try {
          await dispatch({ type: CommandType.DISCARD_REQUEST, id: request.id });
          // a request that was never saved is gone now; otherwise reload its saved editor content
          const restored = get().requests.get(request.id);
          if (restored != null && get().selectedRequestId === request.id) {
            await loadEditorContent(restored);
          }
        } finally {
          resume();
        }
      }),

      saveRequest: reported('Could not save the request', async (id) => {
        await flushModelEdits(id);
        await dispatch({ type: CommandType.SAVE_REQUEST, id });
      }),

      sendRequest: async (id, signal) => {
        await flushModelEdits();
        return await httpService.sendRequest(id, signal);
      },

      addHeader: () =>
        editSelectedRequest('headers', (headers) => {
          headers.push({ key: '', value: '', isActive: true });
        }),

      updateHeader: (index, updatedHeader) =>
        editSelectedRequest('headers', (headers) => {
          if (headers[index] != null) Object.assign(headers[index], updatedHeader);
        }),

      deleteHeader: (index) =>
        editSelectedRequest('headers', (headers) => {
          headers.splice(index, 1);
        }),

      addQueryParam: () =>
        editSelectedRequest('url', (url) => {
          url.query.push({ key: '', value: '', isActive: true });
        }),

      updateQueryParam: (index, updatedParam) =>
        editSelectedRequest('url', (url) => {
          if (url.query[index] != null) Object.assign(url.query[index], updatedParam);
        }),

      deleteQueryParam: (index) =>
        editSelectedRequest('url', (url) => {
          url.query.splice(index, 1);
        }),

      clearQueryParams: () =>
        editSelectedRequest('url', (url) => {
          url.query = [];
        }),

      setQueryParamActive: (index, isActive) =>
        editSelectedRequest('url', (url) => {
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

      addNewFolder: reported('Could not create the folder', async (title, parentId) => {
        const folder: FolderInfo = {
          id: crypto.randomUUID(),
          parentId: parentId ?? get().collection.id,
          type: 'folder',
          title: title ?? randomTitle(),
          lastModified: Date.now(),
        };
        await dispatch({ type: CommandType.CREATE_FOLDER, folder });
        revealFolder(folder.parentId);
      }),

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

      updateAuthorization: (changes) => {
        const request = selectRequest(get());
        if (request == null) return;

        let auth: AuthorizationInformation | null = null;
        if (changes != null) {
          try {
            auth = applyAuthorizationChange(request.auth, changes);
          } catch (error) {
            console.error('Ignoring an invalid authorization change', error);
            return;
          }
        }
        editRequest({ auth });
      },

      updateCollection: reported('Could not change the collection', async (changes) => {
        await dispatch({ type: CommandType.UPDATE_COLLECTION, changes });
      }),

      selectEnvironment: reported('Could not select the environment', async (key) => {
        await dispatch({ type: CommandType.SELECT_ENVIRONMENT, key });
      }),

      closeCollection: reported('Could not close the collection', async (dirPath) => {
        const { collection } = get();
        const targetPath = dirPath ?? collection.dirPath;
        if (targetPath === collection.dirPath) {
          await changeSelectedRequest(undefined);
        }
        console.info('Closing collection at', targetPath);
        await eventService.closeCollection(targetPath);
      }),

      moveItems: reported('Could not move the items', async (ids, parentId, index) => {
        console.info(`Moving items ${ids.join(', ')} to parent ${parentId} at position ${index}`);
        const moved = dispatch({ type: CommandType.MOVE, ids, parentId, index });
        revealFolder(parentId);
        await moved;
      }),
    }))
  );

  return { store, collectionState };
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

// Hook to access the collection store from context
export const useCollectionStore = <T>(
  selector: (state: CollectionStoreState & CollectionStateActions) => T
): T => {
  const store = useContext(CollectionStoreContext);
  if (!store) {
    throw new Error('useCollectionStore must be used within CollectionStoreProvider');
  }
  return useStore(store, selector);
};

export const useCollectionActions = (): CollectionStateActions => useCollectionStore(useActions());

/** Returns the tree of the collection. It only changes when the tree or one of its nodes changes. */
export const useCollectionTree = (): CollectionTree => {
  const childIds = useCollectionStore((state) => state.childIds);
  const folders = useCollectionStore((state) => state.folders);
  const requests = useCollectionStore((state) => state.requests);
  return useMemo(() => ({ childIds, folders, requests }), [childIds, folders, requests]);
};

/** Returned while no request is selected, so the selector stays stable. */
const NO_QUERY_PARAMS: Readonly<TrufosRequest['url']['query']> = Object.freeze([]);

export const selectQueryParams = (
  state: CollectionStoreState
): Readonly<TrufosRequest['url']['query']> => selectRequest(state)?.url.query ?? NO_QUERY_PARAMS;

export const selectRequest = (
  state: CollectionStoreState,
  requestId?: TrufosId
): TrufosRequest | undefined => {
  const id = requestId ?? state.selectedRequestId;
  return id != null ? state.requests.get(id) : undefined;
};

export const selectFolder = (
  state: CollectionStoreState,
  folderId: TrufosId
): FolderInfo | undefined => state.folders.get(folderId);

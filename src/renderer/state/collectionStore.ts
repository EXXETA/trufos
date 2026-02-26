import { createContext, useContext } from 'react';
import { type StoreApi, useStore } from 'zustand';
import { REQUEST_MODEL, SCRIPT_MODEL } from '@/lib/monaco/models';
import { RendererEventService } from '@/services/event/renderer-event-service';
import {
  isRequestInAParentFolder,
  setRequestTextBody,
  setScriptContent,
} from '@/state/helper/collectionUtil';
import { useActions } from '@/state/helper/util';
import { CollectionStateActions } from '@/state/interface/CollectionStateActions';
import { useVariableStore } from '@/state/variableStore';
import { useEnvironmentStore } from '@/state/environmentStore';
import { editor } from 'monaco-editor';
import { isCollection, isRequest, TrufosObject } from 'shim/objects';
import { AuthorizationInformation } from 'shim/objects';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { createStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { parseUrl } from 'shim/objects/url';
import { ScriptType } from 'shim/scripting';

const eventService = RendererEventService.instance;

interface CollectionState {
  /** The currently selected collection */
  collection?: Omit<Collection, 'variables' | 'environments'>;

  /** A map of all requests in the collection */
  requests: Map<TrufosRequest['id'], TrufosRequest>;

  /** A map of all folders in the collection */
  folders: Map<Folder['id'], Folder>;

  /** The ID of the currently selected request */
  selectedRequestId?: TrufosRequest['id'];

  /** The editor instance for text-based request bodies */
  requestEditor?: editor.ICodeEditor;

  /** A set of folder IDs that are currently open in the sidebar */
  openFolders: Set<Folder['id']>;

  /** The currently active script type in the script editor */
  currentScriptType: ScriptType;
}

type CollectionStore = StoreApi<CollectionState & CollectionStateActions>;

// Context for the collection store
const CollectionStoreContext = createContext<CollectionStore | null>(null);

export const CollectionStoreProvider = CollectionStoreContext.Provider;

/**
 * Builds maps of requests and folders from a collection's children tree.
 * Also initializes variable and environment stores.
 */
const buildCollectionItemMaps = (collection: Collection) => {
  const requests = new Map<TrufosRequest['id'], TrufosRequest>();
  const folders = new Map<Folder['id'], Folder>();
  const { initialize: initializeVariables } = useVariableStore.getState();
  const { initialize: initializeEnvironments } = useEnvironmentStore.getState();

  const stack = [...collection.children];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.type === 'folder') {
      folders.set(current.id, current);
      stack.push(...current.children);
    } else if (current.type === 'request') {
      requests.set(current.id, current);
    }
  }

  initializeVariables(collection.variables);
  initializeEnvironments(collection.environments);

  return { requests, folders };
};

// Factory function to create a collection store with initial data
export const createCollectionStore = (collection: Collection) => {
  console.debug('Creating collection store with collection', collection);

  return createStore<CollectionState & CollectionStateActions>()(
    immer((set, get) => ({
      collection,
      openFolders: new Set(),
      currentScriptType: ScriptType.PRE_REQUEST,
      ...buildCollectionItemMaps(collection),

      initialize: (collection) => {
        console.debug('Initializing collection store with collection', collection);
        const { requests, folders } = buildCollectionItemMaps(collection);

        // (re)set initial state
        set((state) => {
          state.collection = collection;
          state.requests = requests;
          state.folders = folders;

          if (state.collection?.id !== collection.id) {
            state.selectedRequestId = undefined;
            state.openFolders = new Set();
          } else {
            if (state.selectedRequestId != null && !state.requests.has(state.selectedRequestId)) {
              state.selectedRequestId = undefined;
            }
            state.openFolders = state.openFolders.intersection(new Set(folders.keys()));
          }
          console.info('Initialized collection:', collection);
        });
      },

      changeCollection: async (collection: Collection | string) => {
        const { setSelectedRequest, initialize } = get();
        await setSelectedRequest(); // deselect current request and persist unsaved changes
        const dirPath = typeof collection === 'string' ? collection : collection.dirPath;
        console.info('Opening collection at', dirPath);
        initialize(await eventService.openCollection(dirPath));
      },

      addNewRequest: async (title, parentId) => {
        const actualParentId = parentId ?? get().collection.id;

        const request = await eventService.saveRequest({
          url: parseUrl('http://'),
          method: RequestMethod.GET,
          draft: true,
          id: null,
          parentId: actualParentId,
          type: 'request',
          title: title ?? (Math.random() + 1).toString(36).substring(7),
          headers: [],
          body: {
            type: RequestBodyType.TEXT,
            mimeType: 'text/plain',
          },
        });
        console.info('Created new request with ID', request.id);

        // TODO: consider adding request directly to state instead of reloading
        const collection = await eventService.loadCollection(true);
        const { initialize, setFolderOpen } = get();
        initialize(collection);

        // Keep parent folder open if item was added to folder
        if (actualParentId !== get().collection.id) {
          setFolderOpen(actualParentId);
        }

        get().setSelectedRequest(request.id);
      },

      updateRequest: (updatedRequest: Partial<TrufosRequest>, overwrite = false) => {
        set((state) => {
          const request = selectRequest(state);
          if (request == null) return;

          if (overwrite) {
            state.requests.set(state.selectedRequestId, updatedRequest as TrufosRequest);
          } else {
            state.requests.set(state.selectedRequestId, {
              ...request,
              draft: true,
              ...updatedRequest,
            });
          }
        });
      },

      setRequestBody: (body) => {
        const { updateRequest } = get();
        updateRequest({ body });
      },

      setRequestBodyMimeType(mimeType?: string) {
        const { body } = selectRequest(get());
        const { setRequestBody } = get();
        setRequestBody({ ...body, mimeType });
      },

      setRequestEditor: (requestEditor) => set({ requestEditor }),

      formatRequestEditorText: async () => {
        const { requestEditor } = get();
        if (requestEditor != null) {
          await requestEditor.getAction('editor.action.formatDocument').run();
        }
      },

      setSelectedRequest: async (id) => {
        console.debug('Setting selected request to', id);
        const state = get();
        const { selectedRequestId, requests, currentScriptType } = state;
        const oldRequest = selectRequest(state);
        if (selectedRequestId === id) return;

        // save current request body and script, then load new ones
        if (oldRequest != null) {
          await eventService.saveRequest(oldRequest, REQUEST_MODEL.getValue());
          await eventService.saveScript(oldRequest, currentScriptType, SCRIPT_MODEL.getValue());
        }
        if (id != null) {
          const request = requests.get(id);
          if (request == null) {
            console.warn('Request with ID', id, 'not found');
            id = undefined;
          }
          await setRequestTextBody(request);
          await setScriptContent(request, currentScriptType);
        } else {
          REQUEST_MODEL.setValue('');
          SCRIPT_MODEL.setValue('');
        }
        set({ selectedRequestId: id });
      },

      setCurrentScriptType: async (type) => {
        const state = get();
        const request = selectRequest(state);
        if (request != null) {
          await eventService.saveScript(request, state.currentScriptType, SCRIPT_MODEL.getValue());
          await setScriptContent(request, type);
        }
        set({ currentScriptType: type });
      },

      deleteRequest: async (id) => {
        await eventService.deleteObject(selectRequest(get(), id));

        set((state) => {
          if (state.selectedRequestId === id) state.selectedRequestId = undefined;
          const request = selectRequest(state, id);
          const parent = selectParent(state, request.parentId);
          parent.children = parent.children.filter((child) => child.id !== id);
          state.requests.delete(id);
        });
      },

      renameRequest: async (id: TrufosRequest['id'], title: string) => {
        const request = selectRequest(get(), id);
        if (request == null) return;

        await eventService.rename(request, title);
        set((state) => {
          state.requests.set(id, {
            ...request,
            title,
          });
        });
      },

      copyRequest: async (id) => {
        const request = selectRequest(get(), id);
        if (request === null) return;

        await eventService.copyRequest(request);

        const collection = await eventService.loadCollection(true);
        const { initialize } = get();
        initialize(collection);
      },

      addHeader: () =>
        set((state) => {
          selectHeaders(state).push({ key: '', value: '', isActive: false });
          selectRequest(state).draft = true;
        }),

      updateHeader: (index, updatedHeader) =>
        set((state) => {
          const headers = selectHeaders(state);
          headers[index] = { ...headers[index], ...updatedHeader };
          selectRequest(state).draft = true;
        }),

      deleteHeader: (index) =>
        set((state) => {
          selectHeaders(state).splice(index, 1);
          selectRequest(state).draft = true;
        }),

      clearHeaders: () =>
        set((state) => {
          selectRequest(state).headers = [];
          selectRequest(state).draft = true;
        }),

      addQueryParam: () =>
        set((state) => {
          selectQueryParams(state).push({ key: '', value: '', isActive: true });
          selectRequest(state).draft = true;
        }),

      updateQueryParam: (index, updatedParam) =>
        set((state) => {
          const queryParam = selectQueryParam(state, index);
          selectQueryParams(state)[index] = { ...queryParam, ...updatedParam };
          selectRequest(state).draft = true;
        }),

      deleteQueryParam: (index) =>
        set((state) => {
          selectQueryParams(state).splice(index, 1);
          selectRequest(state).draft = true;
        }),

      clearQueryParams: () =>
        set((state) => {
          selectRequest(state).url.query = [];
          selectRequest(state).draft = true;
        }),

      setQueryParamActive: (index, isActive) =>
        set((state) => {
          const queryParam = selectQueryParam(state, index);
          queryParam.isActive = isActive ?? !queryParam.isActive;
          selectRequest(state).draft = true;
        }),

      setDraftFlag: () =>
        set((state) => {
          selectRequest(state).draft = true;
        }),

      addNewFolder: async (title?, parentId?) => {
        await eventService.saveFolder({
          id: null,
          parentId: parentId ?? get().collection.id,
          type: 'folder',
          title: title ?? (Math.random() + 1).toString(36).substring(7),
          children: [],
        });

        // Reload collection to get correct indices
        const collection = await eventService.loadCollection(true);
        const { setFolderOpen, initialize } = get();
        if (parentId) {
          setFolderOpen(parentId);
        }
        initialize(collection);
      },

      deleteFolder: async (id) => {
        const folder = selectFolder(get(), id);
        console.info('Deleting folder', folder);
        await eventService.deleteObject(folder);

        const collection = await eventService.loadCollection(true);
        get().initialize(collection);
        set((state) => {
          state.openFolders.delete(id);
          if (isRequestInAParentFolder(state.selectedRequestId, folder)) {
            state.selectedRequestId = undefined;
          }
        });
      },

      renameFolder: async (id: Folder['id'], title: string) => {
        const folder = selectFolder(get(), id);
        if (folder == null) return;

        await eventService.rename(folder, title);
        set((state) => {
          state.folders.set(id, {
            ...folder,
            title: title,
          });
        });
      },

      copyFolder: async (id) => {
        const folder = selectFolder(get(), id);
        if (folder === null) return;

        await eventService.copyFolder(folder);

        const collection = await eventService.loadCollection(true);
        const { initialize } = get();
        initialize(collection);
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

      updateAuthorization: (object, updatedFields) => {
        set((state) => {
          object = selectObject(state, object);
          if (updatedFields == null) {
            delete object.auth;
          } else if (object.auth == null) {
            object.auth = updatedFields as AuthorizationInformation;
          } else {
            object.auth = { ...object.auth, ...updatedFields };
          }

          if (isRequest(object)) {
            object.draft = true;
          }
        });
      },

      closeCollection: async (dirPath?: string) => {
        const { initialize, collection: activeCollection } = get();
        const targetPath = dirPath ?? activeCollection?.dirPath;

        if (!targetPath) {
          console.warn('No collection path provided or active collection found.');
          return;
        }

        console.info('Closing collection at', targetPath);

        const nextCollection = await eventService.closeCollection(targetPath);

        initialize(nextCollection);
      },

      renameCollection: async (title: string) => {
        const current = get().collection;
        if (!current) return;

        await eventService.rename(current as Collection, title);

        set((state) => {
          state.collection.title = title;
        });
      },

      moveItem: async (itemId, newParentId, newIndex) => {
        console.info(`Moving item ${itemId} to parent ${newParentId} at position ${newIndex}`);
        const state = get();
        const item = selectRequest(state, itemId) ?? selectFolder(state, itemId);
        const newParent = selectParent(state, newParentId);

        if (item.parentId === newParentId) {
          // Reorder in frontend state (always has complete children list)
          set((state) => {
            const parent = selectParent(state, newParentId);
            const children = parent.children;
            const oldIndex = children.findIndex((c) => c.id === itemId);
            if (oldIndex !== -1) children.splice(oldIndex, 1);
            children.splice(newIndex, 0, item);
          });

          // Persist new order to backend
          await eventService.reorderItem(newParent, itemId, newIndex);
        } else {
          // Update frontend state immediately to avoid visual snap-back
          set((state) => {
            // Remove item from old parent
            const oldParentState = selectParent(state, item.parentId);
            oldParentState.children = oldParentState.children.filter((c) => c.id !== itemId);

            // Add item to new parent at correct position
            const newParentState = selectParent(state, newParentId);
            const updatedItem = { ...item, parentId: newParentId };
            newParentState.children.splice(newIndex, 0, updatedItem);

            // Update maps
            if (isRequest(updatedItem)) {
              state.requests.set(itemId, updatedItem);
            } else {
              state.folders.set(itemId, updatedItem);
            }

            // Open the target folder so the moved item is visible
            if (!isCollection(newParent)) {
              state.openFolders.add(newParentId);
            }
          });

          // Persist to backend
          if (isRequest(item)) await eventService.saveRequest(item);
          await eventService.moveItem(
            item,
            selectParent(state, item.parentId),
            newParent,
            newIndex
          );
        }
      },
    }))
  );
};

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

export const useCollectionActions = () => useCollectionStore(useActions());

// Export context for the provider to access the raw store
export { CollectionStoreContext };

const selectParent = (state: CollectionState, parentId: string) => {
  if (state.collection.id === parentId) return state.collection as Collection;
  return state.folders.get(parentId)!;
};
const selectObject = <T extends TrufosObject>(state: CollectionState, object: T) =>
  isCollection(object)
    ? (state.collection as T)
    : isRequest(object)
      ? (selectRequest(state, object.id) as T)
      : (selectFolder(state, object.id) as T);

export const selectHeaders = (state: CollectionState) => selectRequest(state).headers;
export const selectQueryParams = (state: CollectionState) => selectRequest(state).url.query;
const selectQueryParam = (state: CollectionState, index: number) =>
  selectQueryParams(state)?.[index];
export const selectRequest = (state: CollectionState, requestId?: TrufosRequest['id']) =>
  state.requests.get(requestId ?? state.selectedRequestId);
export const selectFolder = (state: CollectionState, folderId: Folder['id']) =>
  state.folders.get(folderId);

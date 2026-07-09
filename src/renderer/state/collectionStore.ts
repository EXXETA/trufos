import { createContext, useContext } from 'react';
import { type StoreApi, useStore } from 'zustand';
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
import { createModelsForRequest, disposeModelsForRequest } from '@/lib/monaco/models';
import { isCollection, isRequest, TrufosObject, AuthorizationInformation } from 'shim/objects';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { createStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { parseUrl } from 'shim/objects/url';
import { ScriptType } from 'shim/scripting';
import { SortMode } from '@/components/sidebar/SidebarRequestList/treeUtilities';
import { Assertion, AssertionOperator, AssertionType } from 'shim/objects/assertion';
import { buildAssertionName } from '@/services/assertions/assertion-name';

const eventService = RendererEventService.instance;
const EMPTY_ASSERTIONS: Assertion[] = [];

interface CollectionState {
  /** The currently selected collection */
  collection?: Omit<Collection, 'variables' | 'environments'>;

  /** A map of all requests in the collection */
  requests: Map<TrufosRequest['id'], TrufosRequest>;

  /** A map of all folders in the collection */
  folders: Map<Folder['id'], Folder>;

  /** The ID of the currently selected request */
  selectedRequestId?: TrufosRequest['id'];

  /** A set of folder IDs that are currently open in the sidebar */
  openFolders: Set<Folder['id']>;

  /** The currently active script type in the script editor */
  currentScriptType: ScriptType;

  /** The currently active sort mode for the sidebar */
  sortMode: SortMode;
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
      sortMode: SortMode.DEFAULT,
      ...buildCollectionItemMaps(collection),

      initialize: (collection) => {
        console.debug('Initializing collection store with collection', collection);
        const { requests, folders } = buildCollectionItemMaps(collection);

        // (re)set initial state
        set((state) => {
          const isNewCollection = state.collection?.id !== collection.id;
          state.collection = collection;
          state.requests = requests;
          state.folders = folders;

          if (isNewCollection) {
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
        const actualParentId = parentId ?? get().collection!.id;

        const request = await eventService.saveRequest({
          url: parseUrl('http://'),
          method: RequestMethod.GET,
          draft: true,
          // @ts-expect-error id is assigned by the backend upon creation
          id: null,
          parentId: actualParentId,
          type: 'request',
          lastModified: Date.now(),
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
        if (actualParentId !== get().collection!.id) {
          setFolderOpen(actualParentId);
        }

        get().setSelectedRequest(request.id);
      },

      updateRequest: (updatedRequest: Partial<TrufosRequest>, overwrite = false) => {
        set((state) => {
          const request = selectRequest(state);
          if (request == null) return;

          const requestId = state.selectedRequestId!;
          const nextRequest = overwrite
            ? (updatedRequest as TrufosRequest)
            : { ...request, ...updatedRequest };

          state.requests.set(requestId, nextRequest);
          replaceChild(state, nextRequest);

          if (overwrite) {
            return;
          } else {
            markDraft(state);
          }
        });
      },

      setRequestBody: (body) => {
        const { updateRequest } = get();
        updateRequest({ body });
      },

      setRequestBodyMimeType(mimeType?: string) {
        const { body } = selectRequest(get())!;
        if (body.type === RequestBodyType.FORM_DATA) return; // form data bodies don't have a mime type
        const { setRequestBody } = get();
        setRequestBody({ ...body, mimeType } as typeof body);
      },

      setSelectedRequest: (id) => {
        console.debug('Setting selected request to', id);
        const { selectedRequestId, requests } = get();
        if (selectedRequestId === id) return;
        if (id != null && !requests.has(id)) {
          console.warn('Request with ID', id, 'not found');
          id = undefined;
        }

        // Dispose models for the outgoing request synchronously —
        // this triggers onWillDisposeModel which saves content to disk.
        if (selectedRequestId != null) {
          disposeModelsForRequest(selectedRequestId);
        }

        // Create models for the incoming request synchronously so they are
        // available by the time the next render reads them.
        if (id != null) {
          createModelsForRequest(id);
        }

        set({ selectedRequestId: id });
      },

      setCurrentScriptType: (type) => {
        set({ currentScriptType: type });
      },

      setSortMode: (mode) => {
        set({ sortMode: mode });
      },

      deleteRequest: async (id) => {
        await eventService.deleteObject(selectRequest(get(), id)!);

        // Use setSelectedRequest so model disposal is handled consistently.
        if (get().selectedRequestId === id) {
          get().setSelectedRequest(undefined);
        }

        set((state) => {
          const request = selectRequest(state, id);
          const parent = selectParent(state, request!.parentId);
          parent.children = parent.children.filter((child) => child.id !== id);
          state.requests.delete(id);
        });
      },

      discardChanges: async () => {
        const request = selectRequest(get());
        if (request == null) return;
        const restored = await eventService.discardChanges(request);
        if (restored == null) {
          if (get().selectedRequestId === request.id) {
            get().setSelectedRequest(undefined);
          }
          set((state) => {
            const parent = selectParent(state, request.parentId);
            parent.children = parent.children.filter((child) => child.id !== request.id);
            state.requests.delete(request.id);
          });
          return;
        }
        get().updateRequest(restored, true);
        await setRequestTextBody(request.id, restored);
        for (const scriptType of Object.values(ScriptType)) {
          await setScriptContent(request.id, restored, scriptType);
        }
      },

      renameRequest: async (id: TrufosRequest['id'], title: string) => {
        const request = selectRequest(get(), id);
        if (request == null) return;

        await eventService.rename(request, title);
        set((state) => {
          const updatedRequest = {
            ...request,
            title,
          };
          state.requests.set(id, updatedRequest);
          replaceChild(state, updatedRequest);
        });
      },

      copyRequest: async (id) => {
        const request = selectRequest(get(), id);
        if (request === null) return;

        await eventService.copyRequest({ ...request } as TrufosRequest);

        const collection = await eventService.loadCollection(true);
        const { initialize } = get();
        initialize(collection);
      },

      addHeader: () =>
        set((state) => {
          selectHeaders(state).push({ key: '', value: '', isActive: false });
          markDraft(state);
        }),

      updateHeader: (index, updatedHeader) =>
        set((state) => {
          const headers = selectHeaders(state);
          headers[index] = { ...headers[index], ...updatedHeader };
          markDraft(state);
        }),

      deleteHeader: (index) =>
        set((state) => {
          selectHeaders(state).splice(index, 1);
          markDraft(state);
        }),

      clearHeaders: () =>
        set((state) => {
          selectRequest(state)!.headers = [];
          markDraft(state);
        }),

      addQueryParam: () =>
        set((state) => {
          selectQueryParams(state).push({ key: '', value: '', isActive: true });
          markDraft(state);
        }),

      updateQueryParam: (index, updatedParam) =>
        set((state) => {
          const queryParam = selectQueryParam(state, index);
          selectQueryParams(state)[index] = { ...queryParam, ...updatedParam };
          markDraft(state);
        }),

      deleteQueryParam: (index) =>
        set((state) => {
          selectQueryParams(state).splice(index, 1);
          markDraft(state);
        }),

      clearQueryParams: () =>
        set((state) => {
          selectRequest(state)!.url.query = [];
          markDraft(state);
        }),

      setQueryParamActive: (index, isActive) =>
        set((state) => {
          const queryParam = selectQueryParam(state, index);
          queryParam.isActive = isActive ?? !queryParam.isActive;
          markDraft(state);
        }),

      addFormDataField: () =>
        set((state) => {
          const request = selectRequest(state)!;
          const body = request.body;
          if (body.type !== RequestBodyType.FORM_DATA) return;
          body.fields.push({
            key: '',
            isActive: true,
            value: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
          });
          request.draft = true;
        }),

      updateFormDataField: (index, updatedField) =>
        set((state) => {
          const request = selectRequest(state)!;
          const body = request.body;
          if (body.type !== RequestBodyType.FORM_DATA) return;
          body.fields[index] = { ...body.fields[index], ...updatedField };
          request.draft = true;
        }),

      deleteFormDataField: (index) =>
        set((state) => {
          const request = selectRequest(state)!;
          const body = request.body;
          if (body.type !== RequestBodyType.FORM_DATA) return;
          body.fields.splice(index, 1);
          request.draft = true;
        }),

      addAssertion: () =>
        set((state) => {
          const request = selectRequest(state)!;
          request.assertions ??= [];
          const assertion = {
            id: crypto.randomUUID(),
            isActive: true,
            type: AssertionType.STATUS_CODE,
            operator: AssertionOperator.EQUALS,
            expected: '200',
          };
          request.assertions.push({
            ...assertion,
            name: buildAssertionName(assertion),
            nameManuallyEdited: false,
          });
          markDraft(state);
        }),

      updateAssertion: (index, updatedAssertion) =>
        set((state) => {
          const assertions = ensureAssertions(state);
          if (assertions[index] == null) return;
          assertions[index] = { ...assertions[index], ...updatedAssertion };
          markDraft(state);
        }),

      deleteAssertion: (index) =>
        set((state) => {
          ensureAssertions(state).splice(index, 1);
          markDraft(state);
        }),

      setAssertionActive: (index, active) =>
        set((state) => {
          const assertion = ensureAssertions(state)[index];
          if (assertion == null) return;
          assertion.isActive = active ?? !assertion.isActive;
          markDraft(state);
        }),

      setDraftFlag: () => set(markDraft),

      addNewFolder: async (title?, parentId?) => {
        await eventService.saveFolder({
          // @ts-expect-error id is assigned by the backend upon creation
          id: null,
          parentId: parentId ?? get().collection!.id,
          type: 'folder',
          title: title ?? (Math.random() + 1).toString(36).substring(7),
          lastModified: Date.now(),
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
        const folder = selectFolder(get(), id)!;
        console.info('Deleting folder', folder);
        await eventService.deleteObject(folder);

        const collection = await eventService.loadCollection(true);
        get().initialize(collection);
        set((state) => {
          state.openFolders.delete(id);
          if (isRequestInAParentFolder(state.selectedRequestId!, folder)) {
            state.selectedRequestId = undefined;
          }
        });
      },

      renameFolder: async (id: Folder['id'], title: string) => {
        const folder = selectFolder(get(), id)!;
        if (folder == null) return;

        await eventService.rename(folder, title);
        set((state) => {
          const updatedFolder = { ...folder, title };
          state.folders.set(id, updatedFolder);
          replaceChild(state, updatedFolder);
        });
      },

      copyFolder: async (id) => {
        const folder = selectFolder(get(), id)!;
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
          const newType = (updatedFields as Partial<AuthorizationInformation> | null)?.type;
          if (updatedFields == null) {
            delete object.auth;
          } else if (object.auth == null || (newType != null && newType !== object.auth.type)) {
            // A changed type discriminates a different union member, so replace instead of
            // merging: keeping fields from the previous type (e.g. an OAuth2 `method`) would
            // leave the auth in an invalid, unparseable state.
            object.auth = updatedFields as AuthorizationInformation;
          } else {
            object.auth = { ...object.auth, ...updatedFields };
          }

          if (isRequest(object)) {
            markDraft(state);
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
          state.collection!.title = title;
        });
      },

      moveItem: async (itemId, newParentId, newIndex) => {
        console.info(`Moving item ${itemId} to parent ${newParentId} at position ${newIndex}`);
        const state = get();
        const item = selectRequest(state, itemId) ?? selectFolder(state, itemId);
        const newParent = selectParent(state, newParentId);

        if (item!.parentId === newParentId) {
          // Reorder in frontend state (always has complete children list)
          set((state) => {
            const parent = selectParent(state, newParentId);
            const children = parent.children;
            const oldIndex = children.findIndex((c) => c.id === itemId);
            if (oldIndex !== -1) children.splice(oldIndex, 1);
            children.splice(newIndex, 0, item!);
          });

          // Persist new order to backend
          await eventService.reorderItem(newParent, itemId, newIndex);
        } else {
          // Update frontend state immediately to avoid visual snap-back
          set((state) => {
            // Remove item from old parent
            const oldParentState = selectParent(state, item!.parentId);
            oldParentState.children = oldParentState.children.filter((c) => c.id !== itemId);

            // Add item to new parent at correct position
            const newParentState = selectParent(state, newParentId);
            const updatedItem = { ...item!, parentId: newParentId };
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
          if (isRequest(item!)) await eventService.saveRequest(item!);
          await eventService.moveItem(
            item!,
            selectParent(state, item!.parentId),
            newParent,
            newIndex
          );
        }
      },

      setClientCertificate: async (certificate) => {
        set((state) => {
          if (state.collection) {
            state.collection.clientCertificate = certificate ?? undefined;
          }
        });
        await eventService.setClientCertificate(certificate);
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
  if (state.collection!.id === parentId) return state.collection as Collection;
  return state.folders.get(parentId)!;
};

const replaceChild = (state: CollectionState, child: Folder | TrufosRequest) => {
  const parent = selectParent(state, child.parentId);
  const index = parent.children.findIndex(({ id }) => id === child.id);
  if (index !== -1) {
    parent.children[index] = child;
  }
};

const selectObject = <T extends TrufosObject>(state: CollectionState, object: T) =>
  isCollection(object)
    ? (state.collection as T)
    : isRequest(object)
      ? (selectRequest(state, object.id) as T)
      : (selectFolder(state, object.id) as T);

const markDraft = (state: CollectionState) => {
  const request = selectRequest(state)!;
  request.draft = true;
  request.lastModified = Date.now();
};

export const selectHeaders = (state: CollectionState) => selectRequest(state)!.headers;
export const selectQueryParams = (state: CollectionState) => selectRequest(state)!.url.query;
export const selectAssertions = (state: CollectionState) => {
  const request = selectRequest(state)!;
  return request.assertions ?? EMPTY_ASSERTIONS;
};

const ensureAssertions = (state: CollectionState) => {
  const request = selectRequest(state)!;
  request.assertions ??= [];
  return request.assertions;
};

const selectQueryParam = (state: CollectionState, index: number) =>
  selectQueryParams(state)?.[index];
export const selectRequest = (state: CollectionState, requestId?: TrufosRequest['id']) => {
  const id = requestId ?? state.selectedRequestId;
  return id != null ? state.requests.get(id) : undefined;
};
export const selectFolder = (state: CollectionState, folderId: Folder['id']) =>
  state.folders.get(folderId);

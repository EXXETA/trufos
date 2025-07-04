import { RendererEventService } from '@/services/event/renderer-event-service';
import { isRequestInAParentFolder, setRequestTextBody } from '@/state/helper/collectionUtil';
import { useActions } from '@/state/helper/util';
import { CollectionStateActions } from '@/state/interface/CollectionStateActions';
import { useVariableStore } from '@/state/variableStore';
import { editor } from 'monaco-editor';
import { isCollection, isFolder, isRequest, TrufosObject } from 'shim/objects';
import { AuthorizationInformation } from 'shim/objects/auth';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const eventService = RendererEventService.instance;
eventService.on('before-close', async () => {
  console.info('Saving currently opened request before closing');
  const state = useCollectionStore.getState();
  const request = selectRequest(state);
  if (request != null && request.draft) {
    console.debug(`Saving request with ID ${request.id}`);
    await eventService.saveRequest(
      request,
      useCollectionStore.getState().requestEditor?.getValue()
    );
  }
  eventService.emit('ready-to-close');
});

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
}

export const useCollectionStore = create<CollectionState & CollectionStateActions>()(
  immer((set, get) => ({
    requests: new Map(),
    folders: new Map(),
    openFolders: new Set(),

    initialize: (collection) => {
      const requests = new Map<TrufosRequest['id'], TrufosRequest>();
      const folders = new Map<Folder['id'], Folder>();
      const { initialize: initializeVariables } = useVariableStore.getState();

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

      // (re)set initial state
      set((state) => {
        state.collection = collection;
        state.requests = requests;
        state.folders = folders;
        initializeVariables(collection.variables);

        if (state.collection.id !== collection.id) {
          state.selectedRequestId = undefined;
          state.openFolders = new Set();
        }
        console.info('Initialized collection:', collection);
      });
    },

    changeCollection: async (collection: Collection) => {
      const { setSelectedRequest, initialize } = get();
      await setSelectedRequest(); // persist unsaved changes
      initialize(collection);
    },

    addNewRequest: async (title, parentId) => {
      const request = await eventService.saveRequest({
        url: 'http://',
        method: RequestMethod.GET,
        draft: true,
        id: null,
        parentId: parentId ?? get().collection.id,
        type: 'request',
        title: title ?? (Math.random() + 1).toString(36).substring(7),
        headers: [],
        queryParams: [],
        body: {
          type: RequestBodyType.TEXT,
          mimeType: 'text/plain',
        },
      });
      console.info('Created new request with ID', request.id);

      set((state) => {
        state.requests.set(request.id, request);
        state.selectedRequestId = request.id;
        const parent = selectParent(state, request.parentId);
        parent.children.push(request);
      });
      get().setFolderOpen(parentId);
    },

    updateRequest: (updatedRequest: Partial<TrufosRequest>, overwrite = false) =>
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
      }),

    setRequestBody: (body) => {
      const { updateRequest } = get();
      updateRequest({ body });
    },

    setRequestBodyMimeType(mimeType?: string) {
      const { body } = selectRequest(get());
      const { setRequestBody } = get();
      setRequestBody({ ...body, mimeType });
    },

    setRequestEditor: async (requestEditor) => {
      const request = selectRequest(get());
      if (request != null) {
        await setRequestTextBody(requestEditor, request);
      }
      set({ requestEditor });
    },

    formatRequestEditorText: async () => {
      const state = get();
      const requestEditor = state.requestEditor;
      if (requestEditor) {
        await requestEditor.getAction('editor.action.formatDocument').run();
      }
    },

    setSelectedRequest: async (id) => {
      const state = get();
      const { selectedRequestId, requestEditor, requests } = state;
      if (selectedRequestId === id) return;

      // save current request body and load new request body
      if (requestEditor != null) {
        const oldRequest = selectRequest(state);
        if (oldRequest != null) {
          await eventService.saveRequest(oldRequest, requestEditor.getValue());
        }
        if (id != null) {
          await setRequestTextBody(requestEditor, requests.get(id));
        }
      }
      set({ selectedRequestId: id });
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

    renameRequest(id: TrufosRequest['id'], title: string) {
      set((state) => {
        const request = selectRequest(state, id);
        if (request == null) return;

        // Create a new request object with the updated title
        const updatedRequest = {
          ...request,
          title: title,
        };

        // Update the folders map with the new object
        state.requests.set(id, updatedRequest);
      });
      const request = selectRequest(get(), id);
      eventService.saveRequest(request);
    },

    addHeader: () =>
      set((state) => {
        selectHeaders(state).push({ key: '', value: '', isActive: true });
      }),

    updateHeader: (index, updatedHeader) =>
      set((state) => {
        const headers = selectHeaders(state);
        headers[index] = { ...headers[index], ...updatedHeader };
      }),

    deleteHeader: (index) =>
      set((state) => {
        const headers = selectHeaders(state);
        headers.splice(index, 1);
        if (selectRequest(state).headers.length === 0) {
          state.addHeader();
        }
      }),

    clearHeaders: () =>
      set((state) => {
        const request = selectRequest(state);
        request.headers = [];
        state.addHeader();
      }),

    addQueryParam: () =>
      set((state) => {
        selectQueryParams(state).push({ key: '', value: '', isActive: true });
      }),

    updateQueryParam: (index, updatedParam) =>
      set((state) => {
        const queryParams = selectQueryParams(state);

        if (queryParams[index]) {
          queryParams[index] = { ...queryParams[index], ...updatedParam };
        }
      }),

    deleteQueryParam: (index) =>
      set((state) => {
        const queryParams = selectQueryParams(state);
        queryParams.splice(index, 1);
        if (selectRequest(state).queryParams.length === 0) {
          state.addQueryParam();
        }
      }),

    clearQueryParams: () =>
      set((state) => {
        const request = selectRequest(state);
        request.queryParams = [];
        state.addQueryParam();
      }),

    toggleQueryParam: (index) =>
      set((state) => {
        const queryParams = selectQueryParams(state);
        if (queryParams[index]) {
          queryParams[index].isActive = !queryParams[index].isActive;
        }
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

    renameFolder(id: Folder['id'], title: string) {
      set((state) => {
        const folder = selectFolder(state, id);
        if (folder == null) return;

        // Create a new folder object with the updated title
        const updatedFolder = {
          ...folder,
          title: title,
        };

        // Update the folders map with the new object
        state.folders.set(id, updatedFolder);
      });
      const folder = selectFolder(get(), id);
      eventService.saveFolder(folder);
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
  }))
);

const selectParent = (state: CollectionState, parentId: string) => {
  if (state.collection.id === parentId) return state.collection;
  return state.folders.get(parentId)!;
};
const selectHeaders = (state: CollectionState) => selectRequest(state)?.headers;
const selectQueryParams = (state: CollectionState) => selectRequest(state)?.queryParams;
const selectObject = <T extends TrufosObject>(state: CollectionState, object: T) =>
  isCollection(object)
    ? (state.collection as T)
    : isRequest(object)
      ? (selectRequest(state, object.id) as T)
      : (selectFolder(state, object.id) as T);

export const selectRequest = (state: CollectionState, requestId?: TrufosRequest['id']) =>
  state.requests.get(requestId ?? state.selectedRequestId);
export const selectFolder = (state: CollectionState, folderId: Folder['id']) =>
  state.folders.get(folderId);
export const useCollectionActions = () => useCollectionStore(useActions());

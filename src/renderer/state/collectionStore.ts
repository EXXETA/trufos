import { editor } from 'monaco-editor';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { RequestMethod } from 'shim/objects/request-method';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useActions } from '@/state/util';
import { Folder } from 'shim/objects/folder';
import { CollectionStateActions } from '@/state/interface/CollectionStateActions';
import { IpcPushStream } from '@/lib/ipc-stream';
import { Collection } from 'shim/objects/collection';
import { VariableMap } from 'shim/objects/variables';

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
  collection?: Collection;
  requests: Map<TrufosRequest['id'], TrufosRequest>;
  folders: Map<Folder['id'], Folder>;

  /** The ID of the currently selected request */
  selectedRequestId?: TrufosRequest['id'];

  /** The editor instance for text-based request bodies */
  requestEditor?: editor.ICodeEditor;

  /** A set of folder IDs that are currently open in the sidebar */
  openFolders: Set<Folder['id']>;

  /**
   * Set the variables of the current collection
   * @param variables The new variables to set
   */
  setVariables(variables: VariableMap): Promise<void>;
}

async function setRequestTextBody(requestEditor: editor.ICodeEditor, request: TrufosRequest) {
  // load the new request body
  if (request.body?.type === RequestBodyType.TEXT) {
    const stream = await IpcPushStream.open(request);
    requestEditor.setValue(await IpcPushStream.collect(stream));
  } else {
    requestEditor.setValue('');
  }
}

export const useCollectionStore = create<CollectionState & CollectionStateActions>()(
  immer((set, get) => ({
    requests: new Map(),
    folders: new Map(),
    openFolders: new Set(),

    initialize: (collection) => {
      const requests = new Map<TrufosRequest['id'], TrufosRequest>();
      const folders = new Map<Folder['id'], Folder>();

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

      set({ collection, requests, folders });
      console.info('initialize', get().collection);
    },

    addNewRequest: async (title, parentId) => {
      const { collection } = get();
      const request = await eventService.saveRequest({
        url: 'http://',
        method: RequestMethod.GET,
        draft: true,
        id: null,
        parentId: parentId ?? collection.id,
        type: 'request',
        title: title ?? (Math.random() + 1).toString(36).substring(7),
        headers: [],
        body: {
          type: RequestBodyType.TEXT,
          mimeType: 'text/plain',
        },
      });
      console.info('Created new request with ID', request.id);

      set((state) => {
        state.requests.set(request.id, request);
        const parent = selectParent(state, request.parentId);
        parent.children.push(request);
      });
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

    setRequestEditor: async (requestEditor) => {
      const request = selectRequest(get());
      if (request != null) {
        await setRequestTextBody(requestEditor, request);
      }
      set({ requestEditor });
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
        if (state.selectedRequestId === id) delete state.selectedRequestId;
        const request = selectRequest(state, id);
        const parent = selectParent(state, request.parentId);
        parent.children = parent.children.filter((child) => child.id !== id);
        state.requests.delete(id);
      });
    },

    addHeader: () =>
      set((state) => {
        selectHeaders(state).push({ key: '', value: '', isActive: false });
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

    setDraftFlag: () =>
      set((state) => {
        selectRequest(state).draft = true;
      }),

    isFolderOpen: (id: string) => {
      const state = get();
      return state.openFolders.has(id);
    },

    setFolderOpen: (id: string) => {
      set((state) => {
        state.openFolders.add(id);
      });
    },

    setFolderClose: (id: string) => {
      set((state) => {
        state.openFolders.delete(id);
      });
    },

    setVariables: async (variables) => {
      await eventService.setCollectionVariables(variables);
      set((state) => {
        state.collection.variables = variables;
      });
    },
  }))
);

export const selectParent = (state: CollectionState, parentId: string) => {
  if (state.collection.id === parentId) return state.collection;
  return state.folders.get(parentId)!;
};
export const selectRequest = (state: CollectionState, requestId?: TrufosRequest['id']) =>
  state.requests.get(requestId ?? state.selectedRequestId);
export const selectHeaders = (state: CollectionState) => selectRequest(state)?.headers;
export const selectFolder = (state: CollectionState, folderId: Folder['id']) =>
  state.folders.get(folderId);
export const useCollectionActions = () => useCollectionStore(useActions());

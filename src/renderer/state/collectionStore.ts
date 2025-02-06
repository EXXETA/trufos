import { editor } from 'monaco-editor';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { RequestMethod } from 'shim/objects/request-method';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useActions } from '@/state/util';
import { TrufosObject } from 'shim/objects';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { CollectionStateActions } from '@/state/interface/CollectionStateActions';
import { IpcPushStream } from '@/lib/ipc-stream';

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
  collection?: Omit<Collection, 'dirPath' | 'type'>;

  items: Map<TrufosObject['id'], TrufosObject>;

  /** The ID of the currently selected request */
  selectedRequestId?: TrufosRequest['id'];

  /** The editor instance for text-based request bodies */
  requestEditor?: editor.ICodeEditor;

  folderIsOpen: Map<Folder['id'], boolean>;
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
    items: new Map(),
    folderIsOpen: new Map(),

    initialize: (collection) => {
      const items = new Map<TrufosObject['id'], TrufosObject>();
      items.set(collection.id, collection);

      const stack = [...collection.children];
      while (stack.length > 0) {
        const current = stack.pop()!;
        items.set(current.id, current);
        if (current.type === 'folder') {
          stack.push(...current.children);
        }
      }

      set({ collection, items });
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
        state.items.set(request.id, request);
        const parent = state.items.get(request.parentId) as Collection | Folder;
        parent.children.push(request);
      });
    },

    updateRequest: (updatedRequest: Partial<TrufosRequest>, overwrite = false) =>
      set((state) => {
        const request = selectRequest(state);
        if (request == null) return;

        if (overwrite) {
          state.items.set(state.selectedRequestId, updatedRequest as TrufosRequest);
        } else {
          state.items.set(state.selectedRequestId, {
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
      const { selectedRequestId, requestEditor, items } = state;
      if (selectedRequestId === id) return;

      // save current request body and load new request body
      if (requestEditor != null) {
        const oldRequest = selectRequest(state);
        if (oldRequest != null) {
          await eventService.saveRequest(oldRequest, requestEditor.getValue());
        }
        if (id != null) {
          await setRequestTextBody(requestEditor, items.get(id) as TrufosRequest);
        }
      }
      set({ selectedRequestId: id });
    },

    deleteRequest: async (id) => {
      await eventService.deleteObject(get().items.get(id));

      set((state) => {
        state.items.delete(id);
        if (state.selectedRequestId === id) delete state.selectedRequestId;
      });
      console.info('deleteRequest', get().collection);
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

    // functionality for the sidebar
    isFolderOpen: (id: string) => {
      const state = get();
      return state.folderIsOpen.get(id) ?? false;
    },
    setFolderOpen: (id: string, isOpen: boolean) => {
      set((state) => {
        state.folderIsOpen.set(id, isOpen);
      });
    },
  }))
);

export const selectRequest = (state: CollectionState) =>
  state.items.get(state.selectedRequestId) as TrufosRequest;
export const selectHeaders = (state: CollectionState) => selectRequest(state)?.headers;
export const useCollectionActions = () => useCollectionStore(useActions());

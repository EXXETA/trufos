import { RequestMethod } from 'shim/objects/request-method';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { editor } from 'monaco-editor';
import { TrufosHeader } from 'shim/objects/headers';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useActions } from '@/state/util';
import { Collection } from 'shim/objects/collection';
import { v4 as uuidv4 } from 'uuid';
import { Folder } from '../../shim/objects/folder';
import { CollectionStateActions } from '@/state/interface/CollectionStateActions';

const eventService = RendererEventService.instance;

interface CollectionState {
  selectedRequestIndex: string;
  collectionId: string;
  requestEditor?: editor.ICodeEditor;
  collection: Collection;
  selectedRequest: TrufosRequest;
}

export const useCollectionStore = create<CollectionState & CollectionStateActions>()(
  immer((set, get) => ({
    selectedRequestIndex: '',
    collectionId: '',
    requestEditor: undefined,
    collection: null,
    selectedRequest: null,
    initialize: (collection) => {
      set({
        collectionId: collection.id,
        collection: collection,
      });
    },
    setSelectedRequest: async (index: string) => {
      set({
        selectedRequestIndex: index,
        selectedRequest: findRequestById(get().collection.children, index),
      });
      console.log(get().selectedRequest);
    },
    // requests
    addNewRequest: async (parentId: string) => {
      const request = await eventService.saveRequest({
        url: 'http://',
        method: RequestMethod.GET,
        draft: true,
        id: uuidv4(),
        parentId: parentId,
        type: 'request',
        title: (Math.random() + 1).toString(36).substring(7),
        headers: [],
        body: {
          type: RequestBodyType.TEXT,
          mimeType: 'text/plain',
        },
      });

      const collection = get().collection;
      const folder = collection.children.find(
        (child) => child.id === parentId && child.type === 'folder'
      ) as Folder;
      folder.children.push(request);
    },

    updateRequest: (updatedRequest: Partial<TrufosRequest>, overwrite = false) =>
      set((state) => {
        // const request = selectRequest(state);
        // if (request == null) return;
        //
        // if (overwrite) {
        //   state.requests[state.selectedRequestIndex] = updatedRequest as TrufosRequest;
        // } else {
        //   state.requests[state.selectedRequestIndex] = {
        //     ...request,
        //     draft: true,
        //     ...updatedRequest,
        //   };
        // }
      }),
    setRequestBody: (body) => {
      const { updateRequest } = get();
      updateRequest({ body });
    },

    setRequestEditor: (requestEditor) => set({ requestEditor }),

    deleteRequest: async (index: string) => {
      const { collection, selectedRequestIndex } = get();
      const request = findRequestById(collection.children, index);

      if (request) {
        // Check if the request is at the root level
        if (collection.children.some((child) => child.id === index && child.type === 'request')) {
          collection.children = collection.children.filter((child) => child.id !== index);
        } else {
          // Remove the request from its parent folder recursively
          const removeRequestFromFolder = (children: (Folder | TrufosRequest)[], id: string): boolean => {
            for (const child of children) {
              if (child.type === 'folder') {
                const folder = child as Folder;
                const index = folder.children.findIndex((child) => child.id === id);
                if (index !== -1) {
                  folder.children.splice(index, 1);
                  return true;
                } else if (removeRequestFromFolder(folder.children, id)) {
                  return true;
                }
              }
            }
            return false;
          };
          removeRequestFromFolder(collection.children, index);
        }

        set({ collection: collection });

        // Unselect the request if it is currently selected
        if (selectedRequestIndex === index) {
          set({ selectedRequestIndex: '', selectedRequest: null });
        }
      }
    },

    addHeader: () =>
      set((state) => {
        // selectHeaders(state).push({ key: '', value: '', isActive: false });
      }),

    updateHeader: (index: number, updatedHeader: Partial<TrufosHeader>) =>
      set((state) => {
        // const headers = selectHeaders(state);
        // headers[index] = { ...headers[index], ...updatedHeader };
      }),

    deleteHeader: (index: number) =>
      set((state) => {
        // const headers = selectHeaders(state);
        // headers.splice(index, 1);
        // if (selectRequest(state).headers.length === 0) {
        //   state.addHeader();
        // }
      }),

    clearHeaders: () =>
      set((state) => {
        throw new Error('Method not implemented.');
      }),

    setDraftFlag: () =>
      set((state) => {
        throw new Error('Method not implemented.');
      }),

    // folder
    addNewFolder(parentId: string): Promise<void> {
      throw new Error('Method not implemented.');
    },
    updateFolder(folder: Folder, overwrite: true) {
      throw new Error('Method not implemented.');
    },
    deleteFolder: (index: string) => {
      alert('delete folder');
    },
  }))
);

export const useCollectionActions = () => useCollectionStore(useActions());
export const selectRequest = (state: CollectionState) => state.selectedRequest;

const findRequestById = (
  children: (Folder | TrufosRequest)[],
  id: string
): TrufosRequest | undefined => {
  for (const child of children) {
    if (child.id === id && child.type === 'request') {
      return child as TrufosRequest;
    } else if (child.type === 'folder') {
      const found = findRequestById(child.children, id);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
};

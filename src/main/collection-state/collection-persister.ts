import { PersistenceService } from 'main/persistence/service/persistence-service';
import {
  CollectionCommand,
  CollectionModel,
  getDescendantIds,
  getNode,
} from 'shim/collection-model';
import { getInlineTextBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';

const persistenceService = PersistenceService.instance;

/** What has to be written to disk to persist a command. */
export interface PersistPlan {
  /** Writes that must happen right away, e.g. structural changes. */
  immediate?: () => Promise<void>;
  /** The IDs of requests whose info file is written debounced, as they are edited frequently. */
  debounce?: string[];
}

/**
 * Determines how a command that turned `prev` into `next` is persisted. The returned effects
 * only read the given models, which stay unchanged as they are immutable.
 * @param prev the model before the command was applied
 * @param next the model after the command was applied
 * @param command the applied command
 * @returns the plan to persist the command
 */
export function persistCommand(
  prev: CollectionModel,
  next: CollectionModel,
  command: CollectionCommand
): PersistPlan {
  const saveOrder = (parentId: string) =>
    persistenceService.saveOrder(parentId, next.childIds.get(parentId) ?? []);

  switch (command.type) {
    case 'createRequest': {
      const request = getRequest(next, command.request.id);
      return {
        immediate: async () => {
          await persistenceService.saveRequestInfo(request);
          if (request.body.type === RequestBodyType.TEXT) {
            await persistenceService.writeTextBody(request, getInlineTextBody(request) ?? '');
          }
          await saveOrder(request.parentId);
        },
      };
    }
    case 'createFolder': {
      const folder = getFolder(next, command.folder.id);
      return {
        immediate: async () => {
          await persistenceService.saveFolder(folder);
          await saveOrder(folder.parentId);
        },
      };
    }
    case 'rename': {
      const node = getExistingNode(next, command.id);
      return { immediate: () => persistenceService.rename(node, command.title) };
    }
    case 'move': {
      const oldParentId = getExistingNode(prev, command.id).parentId;
      const newParentId = command.parentId;
      return {
        immediate: async () => {
          if (oldParentId !== newParentId) {
            await persistenceService.move(command.id, newParentId);
            await saveOrder(oldParentId);
          }
          await saveOrder(newParentId);
        },
      };
    }
    case 'delete': {
      const { parentId } = getExistingNode(prev, command.id);
      return {
        immediate: async () => {
          await persistenceService.deleteNode(command.id);
          await saveOrder(parentId);
        },
      };
    }
    case 'copy': {
      const { parentId } = getExistingNode(next, command.idMap[command.id]);
      // parents come before their children, so every parent directory exists when it is needed
      const sourceIds = [command.id, ...getDescendantIds(prev, command.id)];
      return {
        immediate: async () => {
          for (const sourceId of sourceIds) {
            const copyId = command.idMap[sourceId];
            const copy = getExistingNode(next, copyId);
            if (copy.type === 'folder') {
              await persistenceService.saveFolder(copy);
              await saveOrder(copyId);
            } else {
              await persistenceService.saveRequestInfo(copy);
              await persistenceService.copyRequestFiles(getRequest(prev, sourceId), copy);
            }
          }
          await saveOrder(parentId);
        },
      };
    }
    case 'editRequest': {
      if (getRequest(prev, command.id).draft) return { debounce: [command.id] };
      const request = getRequest(next, command.id);
      return { immediate: () => persistenceService.createDraft(request) };
    }
    case 'setTextBody':
    case 'setScript': {
      const hadDraft = getRequest(prev, command.id).draft;
      const request = getRequest(next, command.id);
      return {
        immediate: async () => {
          if (!hadDraft) await persistenceService.createDraft(request);
          if (command.type === 'setTextBody') {
            await persistenceService.writeTextBody(request, command.text);
          } else {
            await persistenceService.saveScript(request, command.scriptType, command.text);
          }
        },
      };
    }
    case 'saveRequest': {
      const draft = getRequest(prev, command.id);
      if (!draft.draft) return {};
      const request = getRequest(next, command.id);
      return {
        immediate: async () => {
          // the latest edits of the draft may not have been written yet, see the debounce above
          await persistenceService.saveRequestInfo(draft);
          await persistenceService.saveChanges(request);
        },
      };
    }
    case 'discardRequest': {
      const draft = getRequest(prev, command.id);
      if (!draft.draft) return {};
      const removed = !next.requests.has(command.id);
      return {
        immediate: async () => {
          await persistenceService.discardChanges(draft);
          if (removed) await saveOrder(draft.parentId);
        },
      };
    }
    case 'renameCollection':
    case 'setVariables':
    case 'setEnvironments':
    case 'setClientCertificate':
    case 'setCollectionAuth':
      return { immediate: () => persistenceService.saveCollectionInfo(next.collection) };
    case 'selectEnvironment':
      // the selected environment is not persisted
      return {};
  }
}

function getExistingNode(model: CollectionModel, id: string | undefined) {
  const node = id == null ? undefined : getNode(model, id);
  if (node == null) throw new Error(`Object ${id} does not exist`);
  return node;
}

function getFolder(model: CollectionModel, id: string) {
  const folder = model.folders.get(id);
  if (folder == null) throw new Error(`Folder ${id} does not exist`);
  return folder;
}

function getRequest(model: CollectionModel, id: string): TrufosRequest {
  const request = model.requests.get(id);
  if (request == null) throw new Error(`Request ${id} does not exist`);
  return request;
}

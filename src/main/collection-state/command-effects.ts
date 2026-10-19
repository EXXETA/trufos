import { PersistenceService } from 'main/persistence/service/persistence-service';
import {
  CollectionCommand,
  CollectionModel,
  CommandType,
  getDescendantIds,
  getExistingFolder,
  getExistingNode,
  getExistingRequest,
} from 'shim/collection-model';
import { TrufosId } from 'shim/objects/id';
import { TrufosRequest } from 'shim/objects/request';

const persistenceService = PersistenceService.instance;

/** What has to be written to disk to persist a command. */
export interface CommandEffects {
  /** Writes that must happen right away, e.g. structural changes. */
  immediate?: () => Promise<void>;
  /** A request whose info file is written later, as it is changed by frequent edits. */
  dirtyRequestId?: TrufosId;
  /**
   * Requests whose info file matches `next` once the immediate writes are done. A delayed write of
   * them is redundant and dropped, even if one of them is the {@link dirtyRequestId}.
   */
  cleanRequestIds?: TrufosId[];
}

/**
 * Determines how a command that turned `prev` into `next` is persisted. The returned effects
 * only read the given models, which stay unchanged as they are immutable.
 * @param prev the model before the command was applied
 * @param next the model after the command was applied
 * @param command the applied command
 * @returns the effects that persist the command
 */
export function getCommandEffects(
  prev: CollectionModel,
  next: CollectionModel,
  command: CollectionCommand
): CommandEffects {
  const effects = getSpecificEffects(prev, next, command);

  // whatever the command was, a request that just became a draft needs its draft directory
  // before anything is written into it. That writes its info file as well.
  const drafts = getCreatedDrafts(prev, next);
  if (drafts.length === 0) return effects;
  const { immediate, cleanRequestIds = [] } = effects;
  return {
    ...effects,
    immediate: async () => {
      for (const draft of drafts) await persistenceService.createDraft(draft);
      await immediate?.();
    },
    cleanRequestIds: [...cleanRequestIds, ...drafts.map((draft) => draft.id)],
  };
}

/** Returns the requests that are a draft in `next`, but were an existing non-draft in `prev`. */
function getCreatedDrafts(prev: CollectionModel, next: CollectionModel): TrufosRequest[] {
  // a request that becomes a draft gets a saved state, so only these few have to be looked at
  if (prev.savedRequests === next.savedRequests) return [];
  return [...next.savedRequests.keys()]
    .filter((id) => !prev.savedRequests.has(id))
    .map((id) => getExistingRequest(next, id));
}

function getSpecificEffects(
  prev: CollectionModel,
  next: CollectionModel,
  command: CollectionCommand
): CommandEffects {
  /** Writes the order of each given parent once. */
  const saveOrders = async (parentIds: Iterable<TrufosId>) => {
    for (const parentId of new Set(parentIds)) {
      await persistenceService.saveOrder(parentId, next.childIds.get(parentId) ?? []);
    }
  };

  switch (command.type) {
    case CommandType.CREATE_REQUEST: {
      const request = getExistingRequest(next, command.request.id);
      return {
        immediate: async () => {
          await persistenceService.saveRequestInfo(request);
          await saveOrders([request.parentId]);
        },
      };
    }
    case CommandType.CREATE_FOLDER: {
      const folder = getExistingFolder(next, command.folder.id);
      return {
        immediate: async () => {
          await persistenceService.saveFolder(folder);
          await saveOrders([folder.parentId]);
        },
      };
    }
    case CommandType.RENAME: {
      const node = getExistingNode(next, command.id);
      const saved = next.savedRequests.get(command.id);
      return { immediate: () => persistenceService.rename(node, saved) };
    }
    case CommandType.MOVE: {
      const oldParentIds = command.ids.map((id) => getExistingNode(prev, id).parentId);
      return {
        immediate: async () => {
          for (const [i, id] of command.ids.entries()) {
            if (oldParentIds[i] !== command.parentId) {
              await persistenceService.move(id, command.parentId);
            }
          }
          await saveOrders([...oldParentIds, command.parentId]);
        },
      };
    }
    case CommandType.DELETE: {
      const parentIds = command.ids.map((id) => getExistingNode(prev, id).parentId);
      return {
        immediate: async () => {
          for (const id of command.ids) await persistenceService.deleteNode(id);
          await saveOrders(parentIds);
        },
      };
    }
    case CommandType.COPY: {
      const parentIds = command.ids.map((id) => getExistingNode(prev, id).parentId);
      // parents come before their children, so every parent directory exists when it is needed
      const sourceIds = command.ids.flatMap((id) => [id, ...getDescendantIds(prev, id)]);
      return {
        immediate: async () => {
          for (const sourceId of sourceIds) {
            const copyId = command.idMap[sourceId];
            const copy = getExistingNode(next, copyId);
            if (copy.type === 'folder') {
              await persistenceService.saveFolder(copy);
              await saveOrders([copyId]);
            } else {
              await persistenceService.saveRequestInfo(copy);
              await persistenceService.copyRequestFiles(getExistingRequest(prev, sourceId), copy);
            }
          }
          await saveOrders(parentIds);
        },
      };
    }
    case CommandType.CREATE_DRAFT:
      // the draft directory is created for every command that creates a draft
      return {};
    case CommandType.EDIT_REQUEST:
      return { dirtyRequestId: command.id };
    // the info file follows text body and script edits as well, as its modification time is the
    // modification time of the request
    case CommandType.SET_TEXT_BODY: {
      const request = getExistingRequest(next, command.id);
      return {
        immediate: () => persistenceService.writeTextBody(request, command.text),
        dirtyRequestId: command.id,
      };
    }
    case CommandType.SET_SCRIPT: {
      const request = getExistingRequest(next, command.id);
      return {
        immediate: () => persistenceService.saveScript(request, command.scriptType, command.text),
        dirtyRequestId: command.id,
      };
    }
    case CommandType.SAVE_REQUEST: {
      const draft = getExistingRequest(prev, command.id);
      if (!draft.draft) return {};
      const request = getExistingRequest(next, command.id);
      return {
        // the latest edits of the draft may not have been written yet, so saving writes them itself
        immediate: async () => {
          await persistenceService.saveRequestInfo(draft);
          await persistenceService.saveChanges(request);
        },
        cleanRequestIds: [command.id],
      };
    }
    case CommandType.DISCARD_REQUEST: {
      const draft = getExistingRequest(prev, command.id);
      if (!draft.draft) return {};
      const removed = !next.requests.has(command.id);
      return {
        immediate: async () => {
          await persistenceService.discardChanges(draft);
          if (removed) await saveOrders([draft.parentId]);
        },
        // the saved info file is the one of the restored request
        cleanRequestIds: [command.id],
      };
    }
    case CommandType.UPDATE_COLLECTION:
      // the selected environment is not persisted, so selecting one writes nothing
      if (next.collection === prev.collection) return {};
      return { immediate: () => persistenceService.saveCollectionInfo(next.collection) };
    case CommandType.UPDATE_FOLDER: {
      const folder = getExistingFolder(next, command.id);
      return { immediate: () => persistenceService.saveFolder(folder) };
    }
  }
}

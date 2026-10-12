import { current, produce, type Draft } from 'immer';
import { TrufosRequest } from '../objects/request';
import { CommandEnvelope, CommandError } from './commands';
import {
  CollectionModel,
  getDescendantIds,
  getNode,
  getValidEnvironmentKey,
  isParent,
  isSelfOrDescendant,
} from './model';

type ModelDraft = Draft<CollectionModel>;

/**
 * Applies a command to the given model draft. This is an Immer recipe: call it inside `produce()`
 * or `produceWithPatches()`. Both processes use it, so it must be deterministic and must not have
 * side effects. Persisting the change is the job of the main process.
 *
 * @throws CommandError if the command cannot be applied to the model
 */
export function applyCommand(model: ModelDraft, envelope: CommandEnvelope): void {
  const { command, timestamp } = envelope;
  switch (command.type) {
    case 'createRequest': {
      const { request } = command;
      assertNewId(model, request.id);
      insertChild(model, request.parentId, request.id, command.index);
      model.requests.set(request.id, { ...request, lastModified: timestamp });
      return;
    }
    case 'createFolder': {
      const { folder } = command;
      assertNewId(model, folder.id);
      insertChild(model, folder.parentId, folder.id, command.index);
      model.folders.set(folder.id, { ...folder, lastModified: timestamp });
      model.childIds.set(folder.id, []);
      return;
    }
    case 'rename': {
      const node = getExistingNode(model, command.id);
      node.title = command.title;
      node.lastModified = timestamp;
      // renaming changes the directory of the saved state as well, see 02_rename_behavior.md
      const saved = model.savedRequests.get(command.id);
      if (saved != null) saved.title = command.title;
      return;
    }
    case 'move': {
      const node = getExistingNode(model, command.id);
      if (!isParent(model, command.parentId)) {
        throw new CommandError(`Parent ${command.parentId} does not exist`);
      } else if (isSelfOrDescendant(model, command.parentId, command.id)) {
        throw new CommandError(`Cannot move ${command.id} into itself`);
      }
      removeChild(model, node.parentId, node.id);
      insertChild(model, command.parentId, node.id, command.index);
      node.parentId = command.parentId;
      const saved = model.savedRequests.get(command.id);
      if (saved != null) saved.parentId = command.parentId;
      return;
    }
    case 'delete': {
      const node = getExistingNode(model, command.id);
      removeChild(model, node.parentId, node.id);
      deleteSubtree(model, node.id);
      return;
    }
    case 'copy': {
      copySubtree(model, command.id, command.idMap, timestamp);
      return;
    }
    case 'editRequest': {
      const request = getDraftRequest(model, command.id, timestamp);
      const { auth, ...changes } = command.changes;
      Object.assign(request, changes);
      if (auth === null) delete request.auth;
      else if (auth !== undefined) request.auth = auth;
      return;
    }
    case 'setTextBody':
    case 'setScript':
      // the content itself is not part of the model, the main process writes it to disk
      getDraftRequest(model, command.id, timestamp);
      return;
    case 'saveRequest': {
      const request = getExistingRequest(model, command.id);
      if (!request.draft) return;
      request.draft = false;
      model.savedRequests.delete(command.id);
      return;
    }
    case 'discardRequest': {
      const request = getExistingRequest(model, command.id);
      if (!request.draft) return;
      const saved = model.savedRequests.get(command.id);
      if (saved == null) {
        removeChild(model, request.parentId, request.id);
        model.requests.delete(request.id);
      } else {
        model.requests.set(command.id, { ...saved, draft: false });
        model.savedRequests.delete(command.id);
      }
      return;
    }
    case 'renameCollection':
      model.collection.title = command.title;
      return;
    case 'setVariables':
      model.collection.variables = command.variables;
      return;
    case 'setEnvironments':
      model.collection.environments = command.environments;
      model.selectedEnvironmentKey = getValidEnvironmentKey(
        model.collection,
        model.selectedEnvironmentKey
      );
      return;
    case 'selectEnvironment':
      if (command.key != null && model.collection.environments[command.key] == null) {
        throw new CommandError(`Environment ${command.key} does not exist`);
      }
      model.selectedEnvironmentKey = command.key;
      return;
    case 'setClientCertificate':
      if (command.clientCertificate == null) delete model.collection.clientCertificate;
      else model.collection.clientCertificate = command.clientCertificate;
      return;
    case 'setCollectionAuth':
      if (command.auth == null) delete model.collection.auth;
      else model.collection.auth = command.auth;
      return;
  }
}

function assertNewId(model: ModelDraft, id: string) {
  if (id === model.collection.id || getNode(model, id) != null) {
    throw new CommandError(`An object with ID ${id} already exists`);
  }
}

function getExistingNode(model: ModelDraft, id: string) {
  const node = getNode(model, id);
  if (node == null) throw new CommandError(`Object ${id} does not exist`);
  return node;
}

function getExistingRequest(model: ModelDraft, id: string) {
  const request = model.requests.get(id);
  if (request == null) throw new CommandError(`Request ${id} does not exist`);
  return request;
}

/** Returns the request with the given ID, turning it into a draft first if it is none yet. */
function getDraftRequest(model: ModelDraft, id: string, timestamp: number) {
  const request = getExistingRequest(model, id);
  if (!request.draft) {
    // current() takes a copy, so later changes to the draft don't leak into the saved state
    model.savedRequests.set(id, current(request));
    request.draft = true;
  }
  request.lastModified = timestamp;
  return request;
}

function insertChild(model: ModelDraft, parentId: string, childId: string, index?: number) {
  const childIds = model.childIds.get(parentId);
  if (childIds == null || !isParent(model, parentId)) {
    throw new CommandError(`Parent ${parentId} does not exist`);
  }
  childIds.splice(Math.min(index ?? childIds.length, childIds.length), 0, childId);
}

function removeChild(model: ModelDraft, parentId: string, childId: string) {
  const childIds = model.childIds.get(parentId);
  const index = childIds?.indexOf(childId) ?? -1;
  if (index !== -1) childIds!.splice(index, 1);
}

function deleteSubtree(model: ModelDraft, id: string) {
  for (const descendantId of [id, ...getDescendantIds(model, id)]) {
    model.folders.delete(descendantId);
    model.requests.delete(descendantId);
    model.savedRequests.delete(descendantId);
    model.childIds.delete(descendantId);
  }
}

function copySubtree(
  model: ModelDraft,
  id: string,
  idMap: Record<string, string>,
  timestamp: number
) {
  const root = getExistingNode(model, id);
  const sourceIds = [id, ...getDescendantIds(model, id)];
  const getCopyId = (sourceId: string) => {
    const copyId = idMap[sourceId];
    if (copyId == null) throw new CommandError(`No ID given for the copy of ${sourceId}`);
    assertNewId(model, copyId);
    return copyId;
  };

  // parents come before their children, so every parent of a copy exists when it is inserted
  for (const sourceId of sourceIds) {
    const copyId = getCopyId(sourceId);
    const source = getExistingNode(model, sourceId);
    const parentId = sourceId === id ? root.parentId : idMap[source.parentId];
    const title = sourceId === id ? `${source.title} (Copy)` : source.title;
    insertChild(model, parentId, copyId);

    if (source.type === 'folder') {
      model.folders.set(copyId, {
        ...current(source),
        id: copyId,
        parentId,
        title,
        lastModified: timestamp,
      });
      model.childIds.set(copyId, []);
    } else {
      // the copy captures what the user sees, i.e. the draft, as its saved state
      const copy: TrufosRequest = {
        ...current(source),
        id: copyId,
        parentId,
        title,
        draft: false,
        lastModified: timestamp,
      };
      model.requests.set(copyId, copy);
    }
  }
}

/** Returns a copy of the model with the command applied, see {@link applyCommand}. */
export function applyCommandTo(model: CollectionModel, envelope: CommandEnvelope): CollectionModel {
  return produce(model, (draft) => applyCommand(draft, envelope));
}

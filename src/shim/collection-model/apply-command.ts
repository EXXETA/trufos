import { current, type Draft, type Patch, produce, produceWithPatches } from 'immer';
import { TrufosRequest } from '../objects/request';
import { CommandEnvelope, CommandError, CommandType } from './commands';
import {
  assignChanges,
  CollectionModel,
  CollectionNodes,
  FolderInfo,
  getDescendantIds,
  getNode,
  getTopLevelIds,
  getValidEnvironmentKey,
  isParent,
  isSelfOrDescendant,
  TreeNode,
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
    case CommandType.CREATE_REQUEST: {
      const { request } = command;
      assertNewId(model, request.id);
      insertChildren(model, request.parentId, [request.id], command.index);
      model.requests.set(request.id, { ...request, lastModified: timestamp });
      return;
    }
    case CommandType.CREATE_FOLDER: {
      const { folder } = command;
      assertNewId(model, folder.id);
      insertChildren(model, folder.parentId, [folder.id], command.index);
      model.folders.set(folder.id, { ...folder, lastModified: timestamp });
      model.childIds.set(folder.id, []);
      return;
    }
    case CommandType.RENAME: {
      const node = getExistingNode(model, command.id);
      node.title = command.title;
      node.lastModified = timestamp;
      // renaming changes the directory of the saved state as well, see 02_rename_behavior.md
      const saved = model.savedRequests.get(command.id);
      if (saved != null) saved.title = command.title;
      return;
    }
    case CommandType.MOVE: {
      const nodes = getTopLevelNodes(model, command.ids);
      if (!isParent(model, command.parentId)) {
        throw new CommandError(`Parent ${command.parentId} does not exist`);
      }
      for (const node of nodes) {
        if (isSelfOrDescendant(model, command.parentId, node.id)) {
          throw new CommandError(`Cannot move ${node.id} into itself`);
        }
      }
      for (const node of nodes) {
        removeChild(model, node.parentId, node.id);
        node.parentId = command.parentId;
        const saved = model.savedRequests.get(node.id);
        if (saved != null) saved.parentId = command.parentId;
      }
      insertChildren(model, command.parentId, command.ids, command.index);
      return;
    }
    case CommandType.DELETE:
      for (const node of getTopLevelNodes(model, command.ids)) {
        removeChild(model, node.parentId, node.id);
        deleteSubtree(model, node.id);
      }
      return;
    case CommandType.COPY:
      for (const node of getTopLevelNodes(model, command.ids)) {
        copySubtree(model, node.id, command.idMap, timestamp);
      }
      return;
    case CommandType.EDIT_REQUEST:
      assignChanges(getDraftRequest(model, command.id, timestamp), command.changes);
      return;
    case CommandType.CREATE_DRAFT:
    case CommandType.SET_TEXT_BODY:
    case CommandType.SET_SCRIPT:
      // the text body and scripts are not part of the model, the main process writes them to disk
      getDraftRequest(model, command.id, timestamp);
      return;
    case CommandType.SAVE_REQUEST: {
      const request = getExistingRequest(model, command.id);
      if (!request.draft) return;
      request.draft = false;
      model.savedRequests.delete(command.id);
      return;
    }
    case CommandType.DISCARD_REQUEST: {
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
    case CommandType.UPDATE_COLLECTION: {
      assignChanges(model.collection, command.changes);
      const key = command.selectedEnvironmentKey;
      if (key === null) {
        model.selectedEnvironmentKey = undefined;
      } else if (key !== undefined) {
        if (model.collection.environments[key] == null) {
          throw new CommandError(`Environment ${key} does not exist`);
        }
        model.selectedEnvironmentKey = key;
      } else if (model.selectedEnvironmentKey != null) {
        // removing the selected environment selects another one, but "none" stays selected
        model.selectedEnvironmentKey = getValidEnvironmentKey(
          model.collection.environments,
          model.selectedEnvironmentKey
        );
      }
      return;
    }
    case CommandType.UPDATE_FOLDER: {
      const folder = getExistingFolder(model, command.id);
      assignChanges(folder, command.changes);
      folder.lastModified = timestamp;
      return;
    }
  }
}

function assertNewId(model: ModelDraft, id: string) {
  if (id === model.collection.id || getNode(model, id) != null) {
    throw new CommandError(`An object with ID ${id} already exists`);
  }
}

/** Returns the folder or request with the given ID. @throws CommandError if there is none */
export function getExistingNode(model: CollectionNodes, id: string): TreeNode {
  const node = getNode(model, id);
  if (node == null) throw new CommandError(`Object ${id} does not exist`);
  return node;
}

/** Returns the request with the given ID. @throws CommandError if there is none */
export function getExistingRequest(model: CollectionNodes, id: string): TrufosRequest {
  const request = model.requests.get(id);
  if (request == null) throw new CommandError(`Request ${id} does not exist`);
  return request;
}

/** Returns the folder with the given ID. @throws CommandError if there is none */
export function getExistingFolder(model: CollectionNodes, id: string): FolderInfo {
  const folder = model.folders.get(id);
  if (folder == null) throw new CommandError(`Folder ${id} does not exist`);
  return folder;
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

/**
 * Returns the folders and requests a bulk command acts on.
 * @throws CommandError if one does not exist, is given twice or is a descendant of another
 */
function getTopLevelNodes(model: ModelDraft, ids: string[]) {
  const nodes = ids.map((id) => getExistingNode(model, id));
  if (new Set(ids).size !== ids.length) throw new CommandError('An object is given more than once');
  if (getTopLevelIds(model, ids).length !== ids.length) {
    throw new CommandError('An object is a descendant of another given object');
  }
  return nodes;
}

function insertChildren(
  model: ModelDraft,
  parentId: string,
  newChildIds: string[],
  index?: number
) {
  const childIds = model.childIds.get(parentId);
  if (childIds == null || !isParent(model, parentId)) {
    throw new CommandError(`Parent ${parentId} does not exist`);
  }
  childIds.splice(Math.min(index ?? childIds.length, childIds.length), 0, ...newChildIds);
}

function removeChild(model: ModelDraft, parentId: string, childId: string) {
  const childIds = model.childIds.get(parentId) ?? [];
  const index = childIds.indexOf(childId);
  if (index !== -1) childIds.splice(index, 1);
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
    insertChildren(model, parentId, [copyId]);

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

/**
 * What the main process does for every command: applies it, increments the version and records the
 * patches that the renderer replays.
 * @returns the new model and the patches that turn the given model into it
 */
export function applyCommandWithPatches(
  model: CollectionModel,
  envelope: CommandEnvelope
): [CollectionModel, Patch[]] {
  const [next, patches] = produceWithPatches(model, (draft) => {
    applyCommand(draft, envelope);
    draft.version++;
  });
  return [next, patches];
}

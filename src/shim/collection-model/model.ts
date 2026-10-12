import { z } from 'zod';
import { enableMapSet, enablePatches, type Patch } from 'immer';
import { Collection } from '../objects/collection';
import { Folder } from '../objects/folder';
import { TrufosRequest } from '../objects/request';

// both processes apply commands and patches to Map-based models
enableMapSet();
enablePatches();

/** A collection without its children. Order and nesting live in {@link CollectionModel.childIds}. */
export type CollectionInfo = Omit<Collection, 'children'>;

/** A folder without its children. Order and nesting live in {@link CollectionModel.childIds}. */
export const FolderInfo = z.object({
  id: z.string().min(1),
  parentId: z.string().min(1),
  type: z.literal('folder'),
  lastModified: z.number(),
  title: z.string(),
}) satisfies z.ZodType<Omit<Folder, 'children'>>;
export type FolderInfo = z.infer<typeof FolderInfo>;

/**
 * The normalized state of the currently open collection. The main process owns it; the renderer
 * holds a replica that it keeps up to date with the patches main broadcasts.
 *
 * Every fact is stored exactly once: the tree structure only in {@link childIds}, and each node only
 * in {@link folders} or {@link requests}. A node's `parentId` always matches the `childIds` entry
 * that contains it.
 */
export interface CollectionModel {
  /** Incremented by the main process for every applied command. */
  version: number;

  /** The collection itself, without children. */
  collection: CollectionInfo;

  /** The key of the selected environment. Not persisted. */
  selectedEnvironmentKey?: string;

  /** All folders of the collection, by ID. */
  folders: Map<FolderInfo['id'], FolderInfo>;

  /** All requests of the collection, by ID. A request with a draft holds the draft state. */
  requests: Map<TrufosRequest['id'], TrufosRequest>;

  /**
   * The saved state of every request that has a draft. A draft request without an entry was never
   * saved.
   */
  savedRequests: Map<TrufosRequest['id'], TrufosRequest>;

  /** The ordered child IDs of the collection and of every folder, by parent ID. */
  childIds: Map<string, string[]>;
}

/** What the main process pushes to the renderer whenever its {@link CollectionModel} changes. */
export type CollectionStateEvent =
  | {
      /** The complete model, e.g. after another collection was opened. */
      kind: 'snapshot';
      model: CollectionModel;
    }
  | {
      /** The changes made by a single command. */
      kind: 'patches';
      /** The model version after applying the patches. */
      version: number;
      patches: Patch[];
      /** The ID of the command that caused the change. */
      commandId: string;
    };

/**
 * Converts a nested collection into a {@link CollectionModel}.
 * @param collection the collection as loaded from disk
 * @param savedRequests the saved state of requests that have a draft
 * @param selectedEnvironmentKey the environment to select. Falls back to the first environment if
 * the collection has no environment with this key.
 */
export function normalizeCollection(
  collection: Collection,
  savedRequests: Iterable<TrufosRequest> = [],
  selectedEnvironmentKey?: string
): CollectionModel {
  const { children, ...info } = collection;
  const model: CollectionModel = {
    version: 0,
    collection: info,
    folders: new Map(),
    requests: new Map(),
    savedRequests: new Map([...savedRequests].map((request) => [request.id, request])),
    childIds: new Map(),
  };
  model.selectedEnvironmentKey = getValidEnvironmentKey(model.collection, selectedEnvironmentKey);

  const queue: { parentId: string; children: (Folder | TrufosRequest)[] }[] = [
    { parentId: info.id, children },
  ];
  for (let entry = queue.pop(); entry != null; entry = queue.pop()) {
    model.childIds.set(
      entry.parentId,
      entry.children.map((child) => child.id)
    );
    for (const child of entry.children) {
      if (child.type === 'folder') {
        const { children: grandChildren, ...folder } = child;
        model.folders.set(folder.id, { ...folder, parentId: entry.parentId });
        queue.push({ parentId: folder.id, children: grandChildren });
      } else {
        model.requests.set(child.id, { ...child, parentId: entry.parentId });
      }
    }
  }

  return model;
}

/**
 * Returns the given environment key if the collection has such an environment, otherwise the key
 * of the first environment (or undefined if there is none).
 */
export function getValidEnvironmentKey(
  collection: Pick<CollectionInfo, 'environments'>,
  key?: string
): string | undefined {
  if (key != null && collection.environments[key] != null) return key;
  return Object.keys(collection.environments)[0];
}

/** Returns true if the ID is the collection or a folder, i.e. something that can have children. */
export function isParent(model: CollectionModel, id: string): boolean {
  return id === model.collection.id || model.folders.has(id);
}

/** Returns the folder or request with the given ID. */
export function getNode(
  model: CollectionModel,
  id: string
): FolderInfo | TrufosRequest | undefined {
  return model.folders.get(id) ?? model.requests.get(id);
}

/** Returns the IDs of all descendants of the given parent, depth first, parents before children. */
export function getDescendantIds(model: CollectionModel, parentId: string): string[] {
  const result: string[] = [];
  for (const childId of model.childIds.get(parentId) ?? []) {
    result.push(childId, ...getDescendantIds(model, childId));
  }
  return result;
}

/** Returns true if `id` is `ancestorId` itself or one of its descendants. */
export function isSelfOrDescendant(
  model: CollectionModel,
  id: string,
  ancestorId: string
): boolean {
  for (let current: string | undefined = id; current != null;) {
    if (current === ancestorId) return true;
    current = getNode(model, current)?.parentId;
  }
  return false;
}

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
export const FolderInfo = Folder.omit({ children: true });
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
  model.selectedEnvironmentKey = getValidEnvironmentKey(
    model.collection.environments,
    selectedEnvironmentKey
  );

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
 * Returns the given environment key if there is such an environment, otherwise the key of the
 * first environment (or undefined if there is none).
 */
export function getValidEnvironmentKey(
  environments: CollectionInfo['environments'],
  key?: string
): string | undefined {
  if (key != null && environments[key] != null) return key;
  return Object.keys(environments)[0];
}

/** The parts of the {@link CollectionModel} that hold its nodes. */
export type CollectionNodes = Pick<CollectionModel, 'folders' | 'requests'>;

/** The parts of the {@link CollectionModel} that describe its tree. */
export type CollectionTree = CollectionNodes & Pick<CollectionModel, 'childIds'>;

/**
 * The structure of the {@link CollectionTree}: the order and nesting of its nodes and which of them
 * are folders. It does not change when a request is edited.
 */
export type CollectionStructure = Pick<CollectionModel, 'childIds' | 'folders'>;

/** A node of the {@link CollectionTree}. */
export type TreeNode = FolderInfo | TrufosRequest;

/**
 * Assigns partial changes to an object: `undefined` leaves a field untouched, `null` removes it
 * and any other value replaces it. This is the convention of all `...Changes` command payloads.
 * @param target the object to change, e.g. an Immer draft
 * @param changes the changes to apply
 */
export function assignChanges<T extends object>(
  target: T,
  changes: { [K in keyof T]?: T[K] | null }
): void {
  for (const key of Object.keys(changes) as (keyof T)[]) {
    const value = changes[key];
    if (value === null) delete target[key];
    else if (value !== undefined) target[key] = value;
  }
}

/** Returns true if the ID is the collection or a folder, i.e. something that can have children. */
export function isParent(
  model: Pick<CollectionModel, 'collection' | 'folders'>,
  id: string
): boolean {
  return id === model.collection.id || model.folders.has(id);
}

/** Returns the folder or request with the given ID. */
export function getNode(nodes: CollectionNodes, id: string): TreeNode | undefined {
  return nodes.folders.get(id) ?? nodes.requests.get(id);
}

/** Returns the children of the collection or of a folder, in order. */
export function getChildren(tree: CollectionTree, parentId: string): TreeNode[] {
  return (tree.childIds.get(parentId) ?? [])
    .map((id) => getNode(tree, id))
    .filter((child) => child != null);
}

/**
 * Visits the descendants of the collection or of a folder depth first, parents before children.
 * Only the structure of the tree is read, so the visitor looks up the nodes it needs itself.
 * @param tree the structure of the tree
 * @param parentId where to start. The parent itself is not visited.
 * @param visit called with the ID of every node, its depth (0 for the children of the parent) and
 * the IDs of its ancestor folders below the parent, outermost first. Returning false skips the
 * children of a folder.
 * @param compare sorts the children of each parent by ID. They keep their order if not given.
 */
export function walkTree(
  tree: CollectionStructure,
  parentId: string,
  visit: (id: string, depth: number, ancestorIds: readonly string[]) => boolean | void,
  compare?: (a: string, b: string) => number
): void {
  const walk = (id: string, ancestorIds: readonly string[]) => {
    const childIds = tree.childIds.get(id) ?? [];
    for (const childId of compare != null ? childIds.toSorted(compare) : childIds) {
      const descend = visit(childId, ancestorIds.length, ancestorIds) !== false;
      if (descend && tree.folders.has(childId)) walk(childId, [...ancestorIds, childId]);
    }
  };
  walk(parentId, []);
}

/** Returns the IDs of all descendants of the given parent, depth first, parents before children. */
export function getDescendantIds(
  tree: Pick<CollectionModel, 'childIds'>,
  parentId: string
): string[] {
  const result: string[] = [];
  for (const childId of tree.childIds.get(parentId) ?? []) {
    result.push(childId, ...getDescendantIds(tree, childId));
  }
  return result;
}

/** Returns the IDs of the folders that contain the given node, innermost first. */
export function getAncestorIds(nodes: CollectionNodes, id: string): string[] {
  const path: string[] = [];
  for (let node = getNode(nodes, id); node != null; node = nodes.folders.get(node.parentId)) {
    path.push(node.id);
  }
  return path.slice(1);
}

/**
 * Returns the given IDs without those inside a folder that is given as well, e.g. the items a bulk
 * action acts on, as acting on a folder already covers its descendants.
 */
export function getTopLevelIds(nodes: CollectionNodes, ids: Iterable<string>): string[] {
  const idSet = new Set(ids);
  return [...idSet].filter(
    (id) => !getAncestorIds(nodes, id).some((ancestorId) => idSet.has(ancestorId))
  );
}

/** Returns true if `id` is `ancestorId` itself or one of its descendants. */
export function isSelfOrDescendant(
  nodes: CollectionNodes,
  id: string,
  ancestorId: string
): boolean {
  return id === ancestorId || getAncestorIds(nodes, id).includes(ancestorId);
}

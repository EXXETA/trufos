import { z } from 'zod';
import { enableMapSet, enablePatches, type Patch } from 'immer';
import { Collection } from '../objects/collection';
import { Folder } from '../objects/folder';
import { TrufosRequest } from '../objects/request';
import {
  AuthorizationInformation,
  AuthorizationInformationNoInherit,
  AuthorizationType,
} from '../objects/auth';
import type { CollectionUiState } from '../collection-ui-state';

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

/** The complete state of the open collection. */
export interface CollectionSnapshot {
  model: CollectionModel;
  /** The UI state stored for the collection, if any. */
  ui?: CollectionUiState;
}

/** What the main process pushes to the renderer whenever its {@link CollectionModel} changes. */
export type CollectionStateEvent =
  | ({
      /** The complete state, e.g. after another collection was opened. */
      kind: 'snapshot';
    } & CollectionSnapshot)
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

/**
 * Returns a list as a `...Changes` value: `null` for an empty list, which removes the field, see
 * {@link assignChanges}.
 */
export function emptyToNull<T>(list: T[]): T[] | null {
  return list.length === 0 ? null : list;
}

/** Returns true if the ID is the collection or a folder, i.e. something that can have children. */
export function isParent(
  model: Pick<CollectionModel, 'collection' | 'folders'>,
  id: string
): boolean {
  return id === model.collection.id || model.folders.has(id);
}

/**
 * Returns where a request or folder inherits its settings from: the folders above it, closest
 * first, followed by the collection.
 * @param model the collection and its folders
 * @param parentId the ID of the parent of the inheriting request or folder
 */
export function getInheritanceChain(
  model: Pick<CollectionModel, 'collection' | 'folders'>,
  parentId: string
): (CollectionInfo | FolderInfo)[] {
  const chain: (CollectionInfo | FolderInfo)[] = [];
  for (
    let folder = model.folders.get(parentId);
    folder != null;
    folder = model.folders.get(folder.parentId)
  ) {
    chain.push(folder);
  }
  chain.push(model.collection);
  return chain;
}

/**
 * Returns where a request or folder inherits its authorization from: the closest folder above it
 * that has an authorization, or else the collection.
 * @param model the collection and its folders
 * @param parentId the ID of the parent of the inheriting request or folder
 */
export function getAuthorizationSource(
  model: Pick<CollectionModel, 'collection' | 'folders'>,
  parentId: string
): CollectionInfo | FolderInfo {
  return (
    getInheritanceChain(model, parentId).find((source) => source.auth != null) ?? model.collection
  );
}

/**
 * Returns the authorization that applies to a request or folder: its own one, or the inherited one
 * if it inherits it.
 * @param model the collection and its folders
 * @param node the request or folder
 * @returns the applying authorization, or undefined if there is none
 */
export function resolveAuthorization(
  model: Pick<CollectionModel, 'collection' | 'folders'>,
  node: { auth?: AuthorizationInformation; parentId: string }
): AuthorizationInformationNoInherit | undefined {
  const { auth } = node;
  if (auth?.type !== AuthorizationType.INHERIT) return auth;
  return getAuthorizationSource(model, node.parentId).auth;
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

/** The parent folder of every node that is inside a folder, by node ID. */
export type ParentFolderIds = ReadonlyMap<string, string>;

/**
 * Where the ancestor helpers look up the parent folder of a node: the nodes themselves, or a
 * {@link ParentFolderIds} index for callers that only follow the structure of the tree.
 */
export type ParentSource = CollectionNodes | ParentFolderIds;

/** Returns the parent folder of every node inside a folder, from the structure of the tree alone. */
export function getParentFolderIds(tree: CollectionStructure): ParentFolderIds {
  const parentIds = new Map<string, string>();
  for (const [parentId, childIds] of tree.childIds) {
    if (!tree.folders.has(parentId)) continue;
    for (const childId of childIds) parentIds.set(childId, parentId);
  }
  return parentIds;
}

/** Returns the folder that contains the given node, or undefined at the top level. */
function getParentFolderId(source: ParentSource, id: string): string | undefined {
  if (!('folders' in source)) return source.get(id);
  const parentId = getNode(source, id)?.parentId;
  return parentId != null && source.folders.has(parentId) ? parentId : undefined;
}

/** Returns the IDs of the folders that contain the given node, innermost first. */
export function getAncestorIds(source: ParentSource, id: string): string[] {
  const path: string[] = [];
  for (let parentId = getParentFolderId(source, id); parentId != null;) {
    path.push(parentId);
    parentId = getParentFolderId(source, parentId);
  }
  return path;
}

/**
 * Returns the given IDs without those inside a folder that is given as well, e.g. the items a bulk
 * action acts on, as acting on a folder already covers its descendants.
 */
export function getTopLevelIds(source: ParentSource, ids: Iterable<string>): string[] {
  const idSet = new Set(ids);
  return [...idSet].filter(
    (id) => !getAncestorIds(source, id).some((ancestorId) => idSet.has(ancestorId))
  );
}

/** Returns true if `id` is `ancestorId` itself or one of its descendants. */
export function isSelfOrDescendant(source: ParentSource, id: string, ancestorId: string): boolean {
  return id === ancestorId || getAncestorIds(source, id).includes(ancestorId);
}

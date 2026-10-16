import { arrayMove } from '@dnd-kit/sortable';
import { CollectionStructure, walkTree } from 'shim/collection-model';
import type { TrufosRequest } from 'shim/objects/request';

/** The fields of a node that the sidebar sorts by. */
export interface SortFields {
  title: string;
  lastModified: number;
}

/**
 * Lists the ID, title and modification time of every request in one flat list of primitives, so
 * a shallow comparison tells whether any of them changed, see `useShallow`. Other edits of a
 * request do not change the result.
 */
export function selectRequestSortFields(
  requests: ReadonlyMap<string, TrufosRequest>
): (string | number)[] {
  return [...requests.values()].flatMap(({ id, title, lastModified }) => [id, title, lastModified]);
}

/**
 * Returns the sort fields of every node: of the folders from the structure, of the requests from
 * the result of {@link selectRequestSortFields}.
 */
export function getSortFields(
  tree: CollectionStructure,
  requestFields: readonly (string | number)[]
): Map<string, SortFields> {
  const fields = new Map<string, SortFields>(tree.folders);
  for (let i = 0; i + 2 < requestFields.length; i += 3) {
    const [id, title, lastModified] = requestFields.slice(i, i + 3);
    fields.set(String(id), { title: String(title), lastModified: Number(lastModified) });
  }
  return fields;
}

/**
 * Returns the most recent save timestamp of every node below the given parent. For a folder, this
 * is the most recent one of the folder and all its descendants.
 * @param tree the structure of the tree
 * @param parentId the collection or folder whose descendants to compute the timestamps of
 * @param fields the sort fields of every node, see {@link getSortFields}
 */
export function getMaxTimestamps(
  tree: CollectionStructure,
  parentId: string,
  fields: ReadonlyMap<string, SortFields>
): Map<string, number> {
  const timestamps = new Map<string, number>();
  const visit = (id: string): number => {
    const childIds = tree.childIds.get(id) ?? [];
    const max = Math.max(fields.get(id)?.lastModified ?? 0, ...childIds.map(visit));
    timestamps.set(id, max);
    return max;
  };
  (tree.childIds.get(parentId) ?? []).forEach(visit);
  return timestamps;
}

/** The parent ID of every node, by node ID. */
export type ParentIds = ReadonlyMap<string, string>;

/** Returns the parent of every node, from the structure of the tree alone. */
export function getParentIds(tree: Pick<CollectionStructure, 'childIds'>): ParentIds {
  const parentIds = new Map<string, string>();
  for (const [parentId, childIds] of tree.childIds) {
    for (const childId of childIds) parentIds.set(childId, parentId);
  }
  return parentIds;
}

function getAncestorIds(parentIds: ParentIds, id: string): string[] {
  const ancestorIds: string[] = [];
  for (let parentId = parentIds.get(id); parentId != null; parentId = parentIds.get(parentId)) {
    ancestorIds.push(parentId);
  }
  return ancestorIds;
}

/**
 * Returns the given IDs without those inside a folder that is given as well, as moving a folder
 * already moves its descendants.
 */
export function getTopLevelIds(parentIds: ParentIds, ids: Iterable<string>): string[] {
  const idSet = new Set(ids);
  return [...idSet].filter((id) => !getAncestorIds(parentIds, id).some((a) => idSet.has(a)));
}

/** Returns true if `id` is `ancestorId` itself or one of its descendants. */
export function isSelfOrDescendant(parentIds: ParentIds, id: string, ancestorId: string): boolean {
  return id === ancestorId || getAncestorIds(parentIds, id).includes(ancestorId);
}

export interface FlattenedItem {
  id: string;
  type: 'request' | 'folder';
  depth: number;
  parentId: string;
}

/** Pixels per depth level for horizontal drag offset. Lower = more sensitive */
export const INDENTATION_WIDTH = 20;

/**
 * Convert the tree below the given parent into a flat list.
 * Only open folders have their children included.
 *
 * @param tree the structure of the collection tree
 * @param parentId the collection or folder whose descendants to list
 * @param openFolders the IDs of the open folders
 * @param compare sorts the children of each parent by ID. They keep their order if not given.
 */
export function flattenTree(
  tree: CollectionStructure,
  parentId: string,
  openFolders: Set<string>,
  compare?: (a: string, b: string) => number
): FlattenedItem[] {
  const items: FlattenedItem[] = [];
  walkTree(
    tree,
    parentId,
    (id, depth, ancestorIds) => {
      const isFolder = tree.folders.has(id);
      const type = isFolder ? 'folder' : 'request';
      items.push({ id, type, depth, parentId: ancestorIds.at(-1) ?? parentId });
      return isFolder && openFolders.has(id);
    },
    compare
  );
  return items;
}

/**
 * Compute the inclusive contiguous range of ids between `anchorId` and `targetId` within
 * `orderedIds` (the current flattened, visible sidebar order). Used for shift-click
 * range-selection. If either id is not found, only `targetId` is selected.
 */
export function getRangeSelection(
  orderedIds: string[],
  anchorId: string,
  targetId: string
): string[] {
  const anchorIndex = orderedIds.indexOf(anchorId);
  const targetIndex = orderedIds.indexOf(targetId);

  if (anchorIndex === -1 || targetIndex === -1) {
    return [targetId];
  }

  const [start, end] =
    anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];

  return orderedIds.slice(start, end + 1);
}

/**
 * Remove all descendants of the given folder IDs from the flat list.
 * Used during drag so children travel with their parent.
 */
export function removeChildrenOf(items: FlattenedItem[], ids: string[]): FlattenedItem[] {
  const excludeParentIds = new Set(ids);
  return items.filter((item) => {
    if (excludeParentIds.has(item.parentId)) {
      if (item.type === 'folder') {
        excludeParentIds.add(item.id);
      }
      return false;
    }
    return true;
  });
}

/**
 * Given the current flat list, the active/over IDs, and the horizontal drag
 * offset, compute the projected depth, parentId, and insertion index.
 */
export function getProjection(
  items: FlattenedItem[],
  activeId: string,
  overId: string,
  dragOffsetX: number,
  collectionId: string,
  openFolders?: Set<string>
): { depth: number; parentId: string; newIndex: number } {
  const overItemIndex = items.findIndex(({ id }) => id === overId);
  const activeItemIndex = items.findIndex(({ id }) => id === activeId);
  const activeItem = items[activeItemIndex];
  const overItem = items[overItemIndex];

  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const newActiveIndex = newItems.findIndex(({ id }) => id === activeId);

  const previousItem = newActiveIndex > 0 ? newItems[newActiveIndex - 1] : undefined;

  const depthOffset = Math.round(dragOffsetX / INDENTATION_WIDTH);
  const projectedDepth = activeItem.depth + depthOffset;

  // Special case: if dropping directly on a closed folder with positive horizontal drag,
  // put it inside that folder
  // Only trigger if: same depth AND intentional right drag (not just hovering)
  if (
    overItem.type === 'folder' &&
    openFolders &&
    !openFolders.has(overItem.id) &&
    activeItem.depth === overItem.depth && // Must be at same level
    dragOffsetX > INDENTATION_WIDTH / 2 // Must drag RIGHT (not just hover)
  ) {
    return {
      depth: overItem.depth + 1,
      parentId: overItem.id,
      newIndex: 0, // Insert as first child
    };
  }

  // Max depth: one deeper than previous folder, or same as previous request
  const maxDepth = previousItem
    ? previousItem.type === 'folder'
      ? previousItem.depth + 1
      : previousItem.depth
    : 0;

  const depth = Math.max(0, Math.min(projectedDepth, maxDepth));

  // Walk backwards to find the parent folder at (depth - 1)
  let parentId = collectionId;
  if (depth > 0) {
    for (let i = newActiveIndex - 1; i >= 0; i--) {
      if (newItems[i].depth === depth - 1 && newItems[i].type === 'folder') {
        parentId = newItems[i].id;
        break;
      }
      if (newItems[i].depth < depth - 1) break;
    }
  }

  // Count direct siblings of the same parent that appear before the new position
  let newIndex = 0;
  for (let i = 0; i < newActiveIndex; i++) {
    if (newItems[i].parentId === parentId && newItems[i].depth === depth) {
      newIndex++;
    }
  }

  return { depth, parentId, newIndex };
}

/**
 * Converts the drop position of a dragged item into the index of a move of several items, so
 * they land where the dragged item was dropped.
 * @param childIds the children of the target parent
 * @param draggedId the dragged item, one of `movedIds`
 * @param dropIndex where the dragged item was dropped, among `childIds` without it
 * @param movedIds all moved items
 * @returns the index among `childIds` without all moved items, see the `move` command
 */
export function getMoveIndex(
  childIds: readonly string[],
  draggedId: string,
  dropIndex: number,
  movedIds: ReadonlySet<string>
): number {
  // the moved items are placed after the last sibling before the drop position that stays
  const anchor = childIds
    .filter((id) => id !== draggedId)
    .slice(0, dropIndex)
    .findLast((id) => !movedIds.has(id));
  return anchor == null ? 0 : childIds.filter((id) => !movedIds.has(id)).indexOf(anchor) + 1;
}

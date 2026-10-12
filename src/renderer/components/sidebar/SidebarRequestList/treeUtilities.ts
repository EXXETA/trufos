import { arrayMove } from '@dnd-kit/sortable';
import type { CollectionModel, FolderInfo } from 'shim/collection-model';
import { TrufosRequest } from 'shim/objects/request';

/** The parts of the collection that describe its tree. */
export type CollectionTree = Pick<CollectionModel, 'childIds' | 'folders' | 'requests'>;

/** A node of the {@link CollectionTree}. */
export type TreeNode = TrufosRequest | FolderInfo;

/**
 * Returns the most recent save timestamp for an item.
 * For folders, recursively returns the max timestamp of all descendants.
 */
export function getMaxTimestamp(item: TreeNode, tree: CollectionTree): number {
  if (item.type === 'request') return tree.requests.get(item.id)?.lastModified ?? item.lastModified;
  return Math.max(
    item.lastModified,
    ...getChildren(tree, item.id).map((child) => getMaxTimestamp(child, tree))
  );
}

/** Returns the children of the collection or of a folder, in order. */
export function getChildren(tree: CollectionTree, parentId: string): TreeNode[] {
  return (tree.childIds.get(parentId) ?? [])
    .map((id) => tree.requests.get(id) ?? tree.folders.get(id))
    .filter((child) => child != null);
}

export enum SortMode {
  DEFAULT = 'default',
  AZ_ASC = 'az-asc',
  AZ_DESC = 'az-desc',
  TIME_DESC = 'time-desc',
  TIME_ASC = 'time-asc',
}
export const SORT_CYCLE: SortMode[] = [
  SortMode.DEFAULT,
  SortMode.AZ_ASC,
  SortMode.AZ_DESC,
  SortMode.TIME_DESC,
  SortMode.TIME_ASC,
];

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
 * @param tree the collection tree
 * @param parentId the collection or folder whose descendants to list
 * @param openFolders the IDs of the open folders
 * @param compare sorts the children of each parent. They keep their order if not given.
 * @param depth the depth of the children of the parent
 */
export function flattenTree(
  tree: CollectionTree,
  parentId: string,
  openFolders: Set<string>,
  compare?: ((a: TreeNode, b: TreeNode) => number) | null,
  depth = 0
): FlattenedItem[] {
  const children = getChildren(tree, parentId);
  if (compare != null) children.sort(compare);
  return children.flatMap((child) => {
    const item: FlattenedItem = {
      id: child.id,
      type: child.type,
      depth,
      parentId,
    };

    if (child.type === 'folder' && openFolders.has(child.id)) {
      return [item, ...flattenTree(tree, child.id, openFolders, compare, depth + 1)];
    }

    return [item];
  });
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

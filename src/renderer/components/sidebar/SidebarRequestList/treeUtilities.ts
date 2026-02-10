import { arrayMove } from '@dnd-kit/sortable';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';

export interface FlattenedItem {
  id: string;
  type: 'request' | 'folder';
  depth: number;
  parentId: string;
}

/** Pixels per depth level for horizontal drag offset. Lower = more sensitive */
export const INDENTATION_WIDTH = 20;

/**
 * Convert a nested tree of children into a flat list.
 * Only open folders have their children included.
 *
 * Uses the `folders` Map as the source of truth for folder children,
 * because immer may not propagate Map mutations back into the tree references.
 */
export function flattenTree(
  children: (TrufosRequest | Folder)[],
  openFolders: Set<string>,
  parentId: string,
  folders: Map<Folder['id'], Folder>,
  depth = 0
): FlattenedItem[] {
  return children.flatMap((child) => {
    const item: FlattenedItem = {
      id: child.id,
      type: child.type,
      depth,
      parentId,
    };

    if (child.type === 'folder' && openFolders.has(child.id)) {
      // Read children from the Map (always up-to-date after moveItem)
      const folderChildren = folders.get(child.id)?.children ?? [];
      return [item, ...flattenTree(folderChildren, openFolders, child.id, folders, depth + 1)];
    }

    return [item];
  });
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

  // Special case: if dropping directly on a closed folder with minimal offset,
  // put it inside that folder
  if (
    overItem.type === 'folder' &&
    openFolders &&
    !openFolders.has(overItem.id) &&
    Math.abs(dragOffsetX) < INDENTATION_WIDTH
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

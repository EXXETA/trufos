import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensors,
  useSensor,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { SidebarContent, SidebarMenu } from '@/components/ui/sidebar';
import { NavFolder } from '@/components/sidebar/SidebarRequestList/Nav/NavFolder';
import { NavRequest } from '@/components/sidebar/SidebarRequestList/Nav/NavRequest';
import {
  flattenTree,
  removeChildrenOf,
  getProjection,
  getMaxTimestamp,
  getRangeSelection,
  getGroupMoveTargets,
  SortMode,
} from './treeUtilities';
import { getTopLevelSelectedItems } from '@/state/helper/collectionUtil';
import { FolderIcon, SmallArrow } from '@/components/icons';
import { httpMethodColor } from '@/services/StyleHelper';
import { cn } from '@/lib/utils';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';
import { NavCreateItem } from '@/components/sidebar/SidebarRequestList/Nav/NavCreateItem';
import { BulkActionBar } from '@/components/sidebar/SidebarRequestList/BulkActionBar';
import { BulkDeleteDialog } from '@/components/sidebar/SidebarRequestList/BulkDeleteDialog';
import { useHotkeys } from '@/hooks/hotKeys/useHotkey';
import { HOTKEYS } from '@/hooks/hotKeys/hotkeys';

import type { CreatingItem, ItemClickHandler } from '@/components/sidebar/SidebarRequestList/types';
interface SidebarRequestListProps {
  creatingItem: CreatingItem;
  onCreateItem: (item: CreatingItem) => void;
}

const DragOverlayFolder = ({ folder }: { folder: Folder }) => {
  return (
    <div
      className={cn(
        'sidebar-request-list-item',
        'flex items-center gap-1 px-5 py-2',
        'bg-background border-accent rounded border shadow-lg',
        'cursor-grabbing'
      )}
    >
      <div className="flex h-6 w-6 items-center justify-center">
        <SmallArrow size={24} />
      </div>
      <div className="flex items-center gap-1">
        <FolderIcon size={16} />
        <span>{folder.title}</span>
      </div>
    </div>
  );
};

const DragOverlayRequest = ({ request }: { request: TrufosRequest }) => {
  return (
    <div
      className={cn(
        'sidebar-request-list-item',
        'flex gap-2 px-5 py-3.5',
        'bg-background border-accent rounded border shadow-lg',
        'cursor-grabbing'
      )}
    >
      <div className={cn('text-xs leading-3 font-bold', httpMethodColor(request.method))}>
        {request.method}
      </div>
      <p className="text-xs leading-3">{request.title ?? request.url}</p>
    </div>
  );
};

/** Drag overlay that looks like the actual sidebar items */
const DragOverlayContent = ({ itemId, groupCount }: { itemId: string; groupCount?: number }) => {
  const request = useCollectionStore((state) => state.requests.get(itemId));
  const folder = useCollectionStore((state) => state.folders.get(itemId));

  const content = folder ? (
    <DragOverlayFolder folder={folder} />
  ) : request ? (
    <DragOverlayRequest request={request} />
  ) : null;

  if (!content) return null;

  return (
    <div className="relative">
      {content}
      {groupCount != null && groupCount > 1 && (
        <span
          className={cn(
            'absolute -top-2 -right-2',
            'flex h-5 min-w-5 items-center justify-center rounded-full px-1',
            'bg-accent-primary text-accent-tertiary text-[10px] font-semibold'
          )}
        >
          +{groupCount - 1}
        </span>
      )}
    </div>
  );
};

export const SidebarRequestList = ({ creatingItem, onCreateItem }: SidebarRequestListProps) => {
  const children = useCollectionStore((state) => state.collection!.children);
  const collectionId = useCollectionStore((state) => state.collection!.id);
  const openFolders = useCollectionStore((state) => state.openFolders);
  const folders = useCollectionStore((state) => state.folders);
  const requests = useCollectionStore((state) => state.requests);
  const sortMode = useCollectionStore((state) => state.sortMode);
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const selectedIds = useCollectionStore((state) => state.selectedIds);
  const {
    moveItem,
    setSelectedRequest,
    toggleItemSelected,
    setSelection,
    clearSelection,
    deleteSelectedItems,
    duplicateSelectedItems,
  } = useCollectionActions();

  const [activeId, setActiveId] = useState<string | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const sidebarWrapperRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );
  const activeSensors = sortMode === SortMode.DEFAULT ? sensors : [];

  const sortFn = useMemo(():
    ((a: TrufosRequest | Folder, b: TrufosRequest | Folder) => number) | null => {
    if (sortMode === SortMode.AZ_ASC) return (a, b) => a.title.localeCompare(b.title);
    if (sortMode === SortMode.AZ_DESC) return (a, b) => b.title.localeCompare(a.title);
    if (sortMode === SortMode.TIME_DESC)
      return (a, b) =>
        getMaxTimestamp(b, requests, folders) - getMaxTimestamp(a, requests, folders);
    if (sortMode === SortMode.TIME_ASC)
      return (a, b) =>
        getMaxTimestamp(a, requests, folders) - getMaxTimestamp(b, requests, folders);
    return null;
  }, [sortMode, requests, folders]);

  const sortedChildren = useMemo(
    () => (sortFn ? children.toSorted(sortFn) : children),
    [children, sortFn]
  );

  const sortedFolders = useMemo(() => {
    if (!sortFn) return folders;
    const result = new Map<string, Folder>();
    folders.forEach((folder, id) => {
      result.set(id, { ...folder, children: [...folder.children].sort(sortFn) });
    });
    return result;
  }, [folders, sortFn]);

  // Flatten the tree for a single SortableContext.
  // We pass the folders Map so flattenTree reads up-to-date children
  // (immer may not propagate Map mutations into tree references).
  const flattenedItems = useMemo(
    () => flattenTree(sortedChildren, openFolders, collectionId, sortedFolders),
    [sortedChildren, openFolders, collectionId, sortedFolders]
  );

  const visibleRequestIds = useMemo(
    () => flattenedItems.filter((item) => item.type === 'request').map((item) => item.id),
    [flattenedItems]
  );

  // Top-level (non-nested) members of the current multi-selection: excludes any selected id
  // that is itself a descendant of another selected folder, since moving that ancestor folder
  // already carries it along.
  const topLevelSelectedIds = useMemo(
    () => getTopLevelSelectedItems(selectedIds, requests, folders).map((item) => item.id),
    [selectedIds, requests, folders]
  );

  // A drag counts as a "group drag" only when the dragged item is itself a top-level member
  // of a multi-selection — dragging a selected item whose ancestor folder is also selected
  // falls back to plain single-item behavior (that row isn't independently sortable anyway,
  // see the `draggedIds` exclusion below).
  const isMultiDrag =
    activeId != null && selectedIds.size > 1 && topLevelSelectedIds.includes(activeId);

  // During drag: remove children of the dragged item(s) so they travel with their parent.
  // For a group drag, every top-level selected folder's children are excluded, not just the
  // actively-dragged item's.
  const draggedIds = useMemo(() => {
    if (!activeId) return [];
    return isMultiDrag ? topLevelSelectedIds : [activeId];
  }, [activeId, isMultiDrag, topLevelSelectedIds]);

  const sortableItems = useMemo(() => {
    if (!activeId) return flattenedItems;
    return removeChildrenOf(flattenedItems, draggedIds);
  }, [flattenedItems, activeId, draggedIds]);

  const sortableIds = useMemo(() => sortableItems.map((item) => item.id), [sortableItems]);

  const handleItemClick: ItemClickHandler = useCallback(
    (id, event, defaultAction) => {
      if (event.shiftKey) {
        const anchor = selectionAnchorRef.current ?? id;
        setSelection(getRangeSelection(sortableIds, anchor, id));
        selectionAnchorRef.current = anchor;
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        toggleItemSelected(id);
        selectionAnchorRef.current = id;
        return;
      }

      clearSelection();
      selectionAnchorRef.current = id;
      defaultAction();
    },
    [sortableIds, setSelection, toggleItemSelected, clearSelection]
  );

  const navigateRequest = (direction: -1 | 1) => {
    if (!selectedRequestId) return;

    const currentIndex = visibleRequestIds.indexOf(selectedRequestId);

    if (currentIndex === -1) return;

    const nextIndex =
      direction < 0
        ? Math.max(currentIndex - 1, 0)
        : Math.min(currentIndex + 1, visibleRequestIds.length - 1);

    const nextRequestId = visibleRequestIds[nextIndex];

    if (nextRequestId && nextRequestId !== selectedRequestId) {
      setSelectedRequest(nextRequestId);
    }
  };

  useHotkeys(
    [
      {
        keys: HOTKEYS.selectPreviousRequest,
        handler: () => navigateRequest(-1),
      },
      {
        keys: HOTKEYS.selectNextRequest,
        handler: () => navigateRequest(1),
      },
    ],
    {
      enabled: !!selectedRequestId,
    }
  );

  useHotkeys(
    [
      {
        keys: HOTKEYS.clearSelection,
        handler: () => clearSelection(),
      },
    ],
    {
      // Scoped independently of the navigation hotkeys above: selection can be non-empty
      // while no request is open. Disabled while the bulk-delete dialog is open so Escape
      // closes the dialog (Radix's own handling) instead of racing with the selection clear.
      enabled: selectedIds.size > 0 && !isBulkDeleteDialogOpen,
    }
  );

  // Mirrors the Escape hotkey above: a click outside the sidebar list + bulk action bar clears
  // the multi-selection. Row clicks already self-handle via handleItemClick; the bulk-delete
  // dialog is excluded via the same gating condition since it's a Radix portal rendered outside
  // this subtree, and clicking its Confirm button must not wipe the selection out from under it.
  useEffect(() => {
    if (selectedIds.size === 0 || isBulkDeleteDialogOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (sidebarWrapperRef.current?.contains(event.target as Node)) return;
      clearSelection();
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [selectedIds.size, isBulkDeleteDialogOpen, clearSelection]);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  };

  const handleDragEnd = async ({ active, over, delta }: DragEndEvent) => {
    if (!over || active.id === over.id || sortMode !== SortMode.DEFAULT) {
      setActiveId(null);
      return;
    }

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    const projection = getProjection(
      sortableItems,
      activeIdStr,
      overIdStr,
      delta.x,
      collectionId,
      openFolders
    );

    setActiveId(null);
    await moveItem(activeIdStr, projection.parentId, projection.newIndex);

    if (isMultiDrag) {
      // Preserve the rest of the group's pre-drag relative order.
      const otherTopLevelIds = flattenedItems
        .filter((item) => item.id !== activeIdStr && topLevelSelectedIds.includes(item.id))
        .map((item) => item.id);

      for (const target of getGroupMoveTargets(projection, otherTopLevelIds)) {
        await moveItem(target.id, target.parentId, target.newIndex);
      }

      clearSelection();
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDuplicateSelected = () => {
    duplicateSelectedItems();
  };

  const handleConfirmBulkDelete = () => {
    setIsBulkDeleteDialogOpen(false);
    deleteSelectedItems();
  };

  // Find the active item for the DragOverlay preview
  const activeItem = activeId ? flattenedItems.find((item) => item.id === activeId) : null;

  const renderItems = useMemo(() => {
    const items = sortableItems.map((item) =>
      item.type === 'folder' ? (
        <NavFolder
          key={item.id}
          folderId={item.id}
          depth={item.depth + 1}
          onCreateItem={onCreateItem}
          onItemClick={handleItemClick}
        />
      ) : (
        <NavRequest
          key={item.id}
          requestId={item.id}
          depth={item.depth + 1}
          onItemClick={handleItemClick}
        />
      )
    );

    if (creatingItem && collectionId) {
      const parentId = creatingItem.parentId;
      let insertIndex = items.length; // Default to bottom
      let depth = 1; // Default depth (root)

      if (parentId !== collectionId) {
        // Find the folder in sortableItems
        const folderIndex = sortableItems.findIndex((item) => item.id === parentId);
        if (folderIndex !== -1) {
          const folderDepth = sortableItems[folderIndex].depth;
          depth = folderDepth + 2; // +1 for children depth, +1 for base depth matching NavFolder
          insertIndex = folderIndex + 1;
          while (
            insertIndex < sortableItems.length &&
            sortableItems[insertIndex].depth > folderDepth
          ) {
            insertIndex++;
          }
        }
      }

      const createRow = (
        <NavCreateItem
          key="creating-item"
          type={creatingItem.type}
          parentId={parentId}
          depth={depth}
          onCancel={() => onCreateItem(null)}
        />
      );

      items.splice(insertIndex, 0, createRow);
    }

    return items;
  }, [sortableItems, creatingItem, collectionId, onCreateItem, handleItemClick]);

  return (
    <>
      <div ref={sidebarWrapperRef} className="contents">
        <BulkActionBar
          count={selectedIds.size}
          onClear={clearSelection}
          onDuplicate={handleDuplicateSelected}
          onDeleteClick={() => setIsBulkDeleteDialogOpen(true)}
        />
        <SidebarContent className="tabs-scrollbar -mr-6 -ml-6 flex-1 overflow-x-hidden overflow-y-auto">
          <DndContext
            sensors={activeSensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <SidebarMenu className="gap-0">{renderItems}</SidebarMenu>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeItem ? (
                <DragOverlayContent
                  itemId={activeItem.id}
                  groupCount={isMultiDrag ? topLevelSelectedIds.length : undefined}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </SidebarContent>
      </div>
      <BulkDeleteDialog
        open={isBulkDeleteDialogOpen}
        count={selectedIds.size}
        onOpenChange={setIsBulkDeleteDialogOpen}
        onConfirm={handleConfirmBulkDelete}
      />
    </>
  );
};

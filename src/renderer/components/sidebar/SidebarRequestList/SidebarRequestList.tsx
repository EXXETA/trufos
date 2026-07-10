import { useMemo, useState } from 'react';
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
import { useCollectionActions, useCollectionStore } from '@/state/appStore';
import { SidebarContent, SidebarMenu } from '@/components/ui/sidebar';
import { NavFolder } from '@/components/sidebar/SidebarRequestList/Nav/NavFolder';
import { NavRequest } from '@/components/sidebar/SidebarRequestList/Nav/NavRequest';
import {
  flattenTree,
  removeChildrenOf,
  getProjection,
  getMaxTimestamp,
  SortMode,
} from './treeUtilities';
import { FolderIcon, SmallArrow } from '@/components/icons';
import { httpMethodColor } from '@/services/StyleHelper';
import { cn } from '@/lib/utils';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';
import { NavCreateItem } from '@/components/sidebar/SidebarRequestList/Nav/NavCreateItem';
import { useHotkeys } from '@/hooks/hotKeys/useHotkey';

import type { CreatingItem } from '@/components/sidebar/SidebarRequestList/types';
interface SidebarRequestListProps {
  creatingItem: CreatingItem;
  onCreateItem: (item: CreatingItem) => void;
}

const DragOverlayFolder = ({ folder }: { folder: any }) => {
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

const DragOverlayRequest = ({ request }: { request: any }) => {
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
const DragOverlayContent = ({ itemId }: { itemId: string }) => {
  const request = useCollectionStore((state) => state.requests.get(itemId));
  const folder = useCollectionStore((state) => state.folders.get(itemId));

  if (folder) {
    return <DragOverlayFolder folder={folder} />;
  }

  if (request) {
    return <DragOverlayRequest request={request} />;
  }

  return null;
};

export const SidebarRequestList = ({ creatingItem, onCreateItem }: SidebarRequestListProps) => {
  const children = useCollectionStore((state) => state.collection!.children);
  const collectionId = useCollectionStore((state) => state.collection!.id);
  const openFolders = useCollectionStore((state) => state.openFolders);
  const folders = useCollectionStore((state) => state.folders);
  const requests = useCollectionStore((state) => state.requests);
  const sortMode = useCollectionStore((state) => state.sortMode);
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const { moveItem, setSelectedRequest } = useCollectionActions();

  const [activeId, setActiveId] = useState<string | null>(null);

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

  // During drag: remove children of the dragged folder so they travel with it
  const sortableItems = useMemo(() => {
    if (!activeId) return flattenedItems;
    return removeChildrenOf(flattenedItems, [activeId]);
  }, [flattenedItems, activeId]);

  const sortableIds = useMemo(() => sortableItems.map((item) => item.id), [sortableItems]);

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
        keys: 'mod+pageup',
        handler: () => navigateRequest(-1),
      },
      {
        keys: 'mod+pagedown',
        handler: () => navigateRequest(1),
      },
    ],
    {
      enabled: !!selectedRequestId,
    }
  );

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
  };

  const handleDragCancel = () => {
    setActiveId(null);
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
        />
      ) : (
        <NavRequest key={item.id} requestId={item.id} depth={item.depth + 1} />
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
  }, [sortableItems, creatingItem, collectionId, onCreateItem]);

  return (
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
          {activeItem ? <DragOverlayContent itemId={activeItem.id} /> : null}
        </DragOverlay>
      </DndContext>
    </SidebarContent>
  );
};

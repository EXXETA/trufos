import { useContext, useMemo, useState } from 'react';
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
import {
  useCollectionActions,
  useCollectionStore,
  CollectionStoreContext,
} from '@/state/collectionStore';
import { SidebarContent, SidebarMenu } from '@/components/ui/sidebar';
import { NavFolder } from '@/components/sidebar/SidebarRequestList/Nav/NavFolder';
import { NavRequest } from '@/components/sidebar/SidebarRequestList/Nav/NavRequest';
import { flattenTree, removeChildrenOf, getProjection } from './treeUtilities';
import { FolderIcon, SmallArrow } from '@/components/icons';
import { httpMethodColor } from '@/services/StyleHelper';
import { cn } from '@/lib/utils';

export const SidebarRequestList = () => {
  const children = useCollectionStore((state) => state.collection.children);
  const collectionId = useCollectionStore((state) => state.collection.id);
  const openFolders = useCollectionStore((state) => state.openFolders);
  const folders = useCollectionStore((state) => state.folders);
  const { moveItem } = useCollectionActions();
  const store = useContext(CollectionStoreContext);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Flatten the tree for a single SortableContext.
  // We pass the folders Map so flattenTree reads up-to-date children
  // (immer may not propagate Map mutations into tree references).
  const flattenedItems = useMemo(
    () => flattenTree(children, openFolders, collectionId, folders),
    [children, openFolders, collectionId, folders]
  );

  // During drag: remove children of the dragged folder so they travel with it
  const sortableItems = useMemo(() => {
    if (!activeId) return flattenedItems;
    return removeChildrenOf(flattenedItems, [activeId]);
  }, [flattenedItems, activeId]);

  const sortableIds = useMemo(() => sortableItems.map((item) => item.id), [sortableItems]);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  };

  const handleDragEnd = ({ active, over, delta }: DragEndEvent) => {
    if (!over || active.id === over.id) {
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

    // Guard: can't drop a folder into its own descendants
    if (store) {
      const state = store.getState();
      const activeItem = state.folders.get(activeIdStr);
      if (activeItem?.type === 'folder' && projection.parentId !== collectionId) {
        const isDescendant = (folderId: string, targetId: string): boolean => {
          if (folderId === targetId) return true;
          const folder = state.folders.get(folderId);
          if (!folder) return false;
          return folder.children.some(
            (child) =>
              child.id === targetId || (child.type === 'folder' && isDescendant(child.id, targetId))
          );
        };
        if (isDescendant(activeIdStr, projection.parentId)) {
          setActiveId(null);
          return;
        }
      }
    }

    moveItem(activeIdStr, projection.parentId, projection.newIndex);
    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  // Find the active item for the DragOverlay preview
  const activeItem = activeId ? flattenedItems.find((item) => item.id === activeId) : null;

  return (
    <SidebarContent className="tabs-scrollbar -mr-6 -ml-6 flex-1 overflow-x-hidden overflow-y-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <SidebarMenu className="gap-0">
            {sortableItems.map((item) =>
              item.type === 'folder' ? (
                <NavFolder key={item.id} folderId={item.id} depth={item.depth + 1} />
              ) : (
                <NavRequest key={item.id} requestId={item.id} depth={item.depth + 1} />
              )
            )}
          </SidebarMenu>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeItem ? <DragOverlayContent itemId={activeItem.id} /> : null}
        </DragOverlay>
      </DndContext>
    </SidebarContent>
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

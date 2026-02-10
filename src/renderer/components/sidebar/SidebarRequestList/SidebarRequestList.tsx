import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensors, useSensor, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { SidebarContent, SidebarMenu } from '@/components/ui/sidebar';
import { NavFolder, DROPPABLE_FOLDER_PREFIX } from '@/components/sidebar/SidebarRequestList/Nav/NavFolder';
import { TrufosRequest } from 'shim/objects/request';
import { Folder } from 'shim/objects/folder';
import { NavRequest } from '@/components/sidebar/SidebarRequestList/Nav/NavRequest';
import { cn } from '@/lib/utils';

/**
 * Render the children of a folder or collection, wrapped in a SortableContext.
 * @param children The children to render
 * @param depth
 */
export function renderChildren(children: (TrufosRequest | Folder)[], depth = 0) {
  const ids = children.map((child) => child.id);
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      {children.map((child) => {
        if (child.type === 'request') {
          return <NavRequest key={child.id} requestId={child.id} depth={depth + 1} />;
        } else if (child.type === 'folder') {
          return <NavFolder key={child.id} folderId={child.id} depth={depth + 1} />;
        }
        return null;
      })}
    </SortableContext>
  );
}

export const SidebarRequestList = () => {
  const children = useCollectionStore((state) => state.collection.children);
  const collectionId = useCollectionStore((state) => state.collection.id);
  const { moveItem } = useCollectionActions();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Droppable zone at collection root for dragging items out of folders
  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({
    id: `collection-root-${collectionId}`,
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over) return;

    const state = useCollectionStore.getState();
    const activeId = active.id as string;
    const overId = over.id as string;

    // Guard: Can't drop on self
    if (activeId === overId) return;

    const activeItem = state.folders.get(activeId) ?? state.requests.get(activeId);
    if (!activeItem) {
      console.warn('Active item not found:', activeId);
      return;
    }

    // Guard: Can't drop folder into its own descendants
    if (activeItem.type === 'folder') {
      const isDescendant = (folderId: string, targetId: string): boolean => {
        const folder = state.folders.get(folderId);
        if (!folder) return false;
        for (const child of folder.children) {
          if (child.id === targetId) return true;
          if (child.type === 'folder' && isDescendant(child.id, targetId)) return true;
        }
        return false;
      };

      if (isDescendant(activeId, overId)) {
        console.warn('Cannot drop folder into its own descendant');
        return;
      }
    }

    // Drop into collection root (move to top level)
    if (overId.startsWith('collection-root-')) {
      const targetCollectionId = overId.replace('collection-root-', '');
      if (activeItem.parentId === targetCollectionId) {
        console.warn('Already at collection root');
        return;
      }
      moveItem(activeId, targetCollectionId, state.collection.children.length);
      return;
    }

    // Drop into a folder via its droppable zone
    if (overId.startsWith(DROPPABLE_FOLDER_PREFIX)) {
      const targetFolderId = overId.slice(DROPPABLE_FOLDER_PREFIX.length);
      if (targetFolderId === activeId) return;

      // Guard: Don't drop back into current parent at the end
      if (targetFolderId === activeItem.parentId) {
        console.warn('Already in this folder');
        return;
      }

      const targetChildren = state.folders.get(targetFolderId)?.children ?? [];
      moveItem(activeId, targetFolderId, targetChildren.length);
      return;
    }

    const getParentId = (id: string) =>
      state.requests.get(id)?.parentId ?? state.folders.get(id)?.parentId;

    const overParentId = getParentId(overId);
    if (!overParentId) {
      console.warn('Over parent not found for:', overId);
      return;
    }

    const getChildren = (parentId: string) => {
      if (parentId === state.collection.id) return state.collection.children;
      return state.folders.get(parentId)?.children ?? [];
    };

    const overSiblings = getChildren(overParentId);
    const overIndex = overSiblings.findIndex((c) => c.id === overId);
    if (overIndex === -1) {
      console.warn('Over item not found in parent children:', overId);
      return;
    }

    moveItem(activeId, overParentId, overIndex);
  };

  return (
    <SidebarContent className={'tabs-scrollbar -mr-6 -ml-6 flex-1 overflow-y-auto'}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SidebarMenu className="gap-0">
          {renderChildren(children)}
          {/* Drop zone for moving items to collection root */}
          <div
            ref={setRootDropRef}
            className={cn(
              'h-16 w-full transition-colors',
              isRootOver && 'bg-accent/20 border-2 border-accent border-dashed rounded'
            )}
          >
            {isRootOver && (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                Drop here to move to collection root
              </div>
            )}
          </div>
        </SidebarMenu>
      </DndContext>
    </SidebarContent>
  );
};

import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensors, useSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { SidebarContent, SidebarMenu } from '@/components/ui/sidebar';
import { NavFolder, DROPPABLE_FOLDER_PREFIX } from '@/components/sidebar/SidebarRequestList/Nav/NavFolder';
import { TrufosRequest } from 'shim/objects/request';
import { Folder } from 'shim/objects/folder';
import { NavRequest } from '@/components/sidebar/SidebarRequestList/Nav/NavRequest';

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
  const { moveItem } = useCollectionActions();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over) return;

    const state = useCollectionStore.getState();
    const activeId = active.id as string;
    const overId = over.id as string;

    // Drop into a folder via its droppable zone
    if (overId.startsWith(DROPPABLE_FOLDER_PREFIX)) {
      const targetFolderId = overId.slice(DROPPABLE_FOLDER_PREFIX.length);
      if (targetFolderId === activeId) return;
      const targetChildren = state.folders.get(targetFolderId)?.children ?? [];
      moveItem(activeId, targetFolderId, targetChildren.length);
      return;
    }

    // Standard reorder / cross-parent move onto another item
    if (activeId === overId) return;

    const getParentId = (id: string) =>
      state.requests.get(id)?.parentId ?? state.folders.get(id)?.parentId;

    const overParentId = getParentId(overId);
    if (!overParentId) return;

    const getChildren = (parentId: string) => {
      if (parentId === state.collection.id) return state.collection.children;
      return state.folders.get(parentId)?.children ?? [];
    };

    const overSiblings = getChildren(overParentId);
    const overIndex = overSiblings.findIndex((c) => c.id === overId);
    if (overIndex === -1) return;

    moveItem(activeId, overParentId, overIndex);
  };

  return (
    <SidebarContent className={'tabs-scrollbar -mr-6 -ml-6 flex-1 overflow-y-auto'}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SidebarMenu className="gap-0">{renderChildren(children)}</SidebarMenu>
      </DndContext>
    </SidebarContent>
  );
};

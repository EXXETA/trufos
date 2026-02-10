import { Folder } from 'shim/objects/folder';
import { SidebarGroup, SidebarMenuSub, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FolderDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/FolderDropdown';
import { selectFolder, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { renderChildren } from '@/components/sidebar/SidebarRequestList/SidebarRequestList';
import { cn } from '@/lib/utils';
import { FolderIcon, SmallArrow } from '@/components/icons';
import { getIndentation } from '@/components/sidebar/SidebarRequestList/Nav/indentation';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface NavFolderProps {
  folderId: Folder['id'];
  depth?: number;
}

export const DROPPABLE_FOLDER_PREFIX = 'droppable-folder-';

export const NavFolder = ({ folderId, depth = 0 }: NavFolderProps) => {
  const { setFolderOpen, setFolderClose } = useCollectionActions();
  const isFolderOpen = useCollectionStore((state) => state.isFolderOpen(folderId));
  const folder = useCollectionStore((state) => selectFolder(state, folderId));
  const children = useCollectionStore((state) => selectFolder(state, folderId).children);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folderId,
  });

  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `${DROPPABLE_FOLDER_PREFIX}${folderId}`,
  });

  if (folder.type !== 'folder') return null;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab">
      <Collapsible
        asChild
        open={isFolderOpen}
        onOpenChange={(open) => (open ? setFolderOpen(folderId) : setFolderClose(folderId))}
        className="group/collapsible"
      >
        <SidebarGroup className={cn('overflow-x-hidden p-0')}>
          <CollapsibleTrigger asChild>
            <SidebarMenuSubButton
              ref={setDropRef}
              className={cn(
                'sidebar-request-list-item',
                'flex',
                'items-center',
                'py-2',
                'px-5',
                'cursor-pointer',
                'gap-1',
                'hover:[background-color:#333333]',
                isOver && 'ring-1 ring-inset ring-accent',
                getIndentation(depth)
              )}
            >
              <div
                className={cn(
                  'h-6 w-6',
                  'transition-transform duration-300 ease-in-out',
                  isFolderOpen ? 'rotate-0' : 'rotate-270'
                )}
              >
                <SmallArrow size={24} />
              </div>

              <div className="flex items-center gap-1">
                <FolderIcon size={16} />
                <span>{folder.title}</span>
              </div>

              <FolderDropdown folder={folder} />
            </SidebarMenuSubButton>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <SidebarMenuSub>{renderChildren(children, depth)}</SidebarMenuSub>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    </div>
  );
};

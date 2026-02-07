import { Folder } from 'shim/objects/folder';
import { SidebarGroup, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { FolderDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/FolderDropdown';
import { selectFolder, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { cn } from '@/lib/utils';
import { FolderIcon, SmallArrow } from '@/components/icons';
import { getIndentation } from '@/components/sidebar/SidebarRequestList/Nav/indentation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavFolderProps {
  folderId: Folder['id'];
  depth?: number;
}

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export const NavFolder = ({ folderId, depth = 0 }: NavFolderProps) => {
  const { setFolderOpen, setFolderClose } = useCollectionActions();
  const isFolderOpen = useCollectionStore((state) => state.isFolderOpen(folderId));
  const folder = useCollectionStore((state) => selectFolder(state, folderId));

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folderId,
  });

  if (folder?.type !== 'folder') return null;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const toggleFolder = () => {
    if (isFolderOpen) {
      setFolderClose(folderId);
    } else {
      setFolderOpen(folderId);
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative">
      <Collapsible
        asChild
        open={isFolderOpen}
        onOpenChange={(open) => (open ? setFolderOpen(folderId) : setFolderClose(folderId))}
        className="group/collapsible"
      >
        <SidebarGroup className={cn('overflow-x-hidden p-0')}>
          <CollapsibleTrigger asChild>
            <SidebarMenuSubButton
              {...listeners}
              className={cn(
                'sidebar-request-list-item',
                'group',
                'flex',
                'items-center',
                'py-2',
                'px-5',
                'cursor-grab active:cursor-grabbing',
                'gap-1',
                'hover:[background-color:#333333]',
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

              <div className="flex min-w-0 flex-1 items-center gap-1">
                <FolderIcon size={16} />
                <span className="truncate">{folder.title}</span>
              </div>

              <div
                className="sidebar-row-menu flex h-4 w-4 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                onClick={stopPropagation}
                onPointerDown={stopPropagation}
              >
                <FolderDropdown folder={folder} />
              </div>
            </SidebarMenuSubButton>
          </CollapsibleTrigger>

          <CollapsibleContent />
        </SidebarGroup>
      </Collapsible>
    </div>
  );
};

import { Folder } from 'shim/objects/folder';
import { SidebarGroup, SidebarMenuSub, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FolderDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/FolderDropdown';
import { selectFolder, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { renderChildren } from '@/components/sidebar/SidebarRequestList/SidebarRequestList';
import { cn } from '@/lib/utils';
import { FolderIcon, SmallArrow } from '@/components/icons';

interface NavFolderProps {
  folderId: Folder['id'];
}

export const NavFolder = ({ folderId }: NavFolderProps) => {
  const { setFolderOpen, setFolderClose } = useCollectionActions();
  const isFolderOpen = useCollectionStore((state) => state.openFolders.has(folderId));
  const folder = useCollectionStore((state) => selectFolder(state, folderId));
  const children = useCollectionStore((state) => selectFolder(state, folderId).children);
  if (folder.type !== 'folder') return null;

  return (
    <Collapsible
      asChild
      open={isFolderOpen}
      onOpenChange={(open) => (open ? setFolderOpen(folderId) : setFolderClose(folderId))}
      className="group/collapsible"
    >
      <SidebarGroup className={cn('overflow-x-hidden p-0')}>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton
            className={cn(
              'sidebar-request-list-item',
              'flex',
              'items-center',
              'py-2',
              'px-5',
              'cursor-pointer',
              'gap-1',
              'hover:bg-disabled'
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
          <SidebarMenuSub
            className={cn(
              'p-0'
              // TODO: provide decent animation
              // 'overflow-hidden transition-all duration-300 ease-in-out',
              // 'data-[state=open]:animate-in',
              // 'data-[state=closed]:animate-out'
            )}
          >
            {renderChildren(children)}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
};

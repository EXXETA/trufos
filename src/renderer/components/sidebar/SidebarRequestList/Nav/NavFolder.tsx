import { Folder } from 'shim/objects/folder';
import { NavRequest } from '@/components/sidebar/SidebarRequestList/Nav/NavRequest';
import React from 'react';
import { TrufosRequest } from 'shim/objects/request';
import { SidebarMenuSub, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FaRegFolderClosed, FaRegFolderOpen } from 'react-icons/fa6';
import { FolderDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/FolderDropdown';
import { useCollectionStore } from '@/state/collectionStore';

interface NavFolderProps {
  folder: Folder;
}

export const NavFolder = ({ folder }: NavFolderProps) => {
  const { isFolderOpen, setFolderOpen, items } = useCollectionStore();
  return (
    <Collapsible
      key={folder.id}
      asChild
      defaultOpen={isFolderOpen(folder.id)}
      onOpenChange={(open) => setFolderOpen(folder.id, open)}
      className={`group/collapsible`}
    >
      <SidebarMenuSub>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton>
            {isFolderOpen(folder.id) ? <FaRegFolderOpen /> : <FaRegFolderClosed />}
            <span>{folder.title}</span>
            <FolderDropdown folder={folder} />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {folder.children.map((child: TrufosRequest | Folder) => {
            if (child.type == 'request' && items.has(child.id)) {
              return <NavRequest key={child.id} request={items.get(child.id) as TrufosRequest} />;
            } else if (child.type == 'folder' && items.has(child.id)) {
              return <NavFolder key={child.id} folder={items.get(child.id) as Folder} />;
            }
          })}
        </CollapsibleContent>
      </SidebarMenuSub>
    </Collapsible>
  );
};

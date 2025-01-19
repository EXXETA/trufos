import { Folder } from 'shim/objects/folder';
import { NavRequest } from '@/components/sidebar/SidebarRequestList/Nav/NavRequest';
import React, { useState } from 'react';
import { TrufosRequest } from 'shim/objects/request';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { FaRegFolderClosed } from 'react-icons/fa6';
import { NavFolder } from '@/components/sidebar/SidebarRequestList/Nav/NavFolder';
import { FolderDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/FolderDropdown';

interface NavFolderProps {
  folder: Folder;
}
export const RootFolder = ({ folder }: NavFolderProps) => {
  const [isActive] = useState(false);
  return (
    <Collapsible key={folder.id} asChild defaultOpen={isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={folder.title}>
            <FaRegFolderClosed />
            <span>{folder.title}</span>
            <ChevronRight
              className={`ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90`}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {folder.children.map((child: TrufosRequest | Folder) => {
            if (child.type === 'request') {
              return <NavRequest request={child as TrufosRequest} />;
            } else if (child.type === 'folder') {
              return <NavFolder folder={child as Folder} />;
            }
          })}
        </CollapsibleContent>
        <FolderDropdown />
      </SidebarMenuItem>
    </Collapsible>
  );
};

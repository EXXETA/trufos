import { Folder } from 'shim/objects/folder';
import { NavRequest } from '@/components/sidebar/SidebarRequestList/Nav/NavRequest';
import React, { useState } from 'react';
import { TrufosRequest } from 'shim/objects/request';
import { SidebarMenuSub, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { FaRegFolderClosed } from 'react-icons/fa6';
import { FolderDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/FolderDropdown';
import { cn } from '@/lib/utils';

interface NavFolderProps {
  folder: Folder;
}

export const NavFolder = ({ folder }: NavFolderProps) => {
  const [isActive, setIsActive] = useState(false);
  return (
    <Collapsible
      key={folder.id}
      asChild
      defaultOpen={isActive}
      onOpenChange={setIsActive}
      className={`group/collapsible`}
    >
      <SidebarMenuSub>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton>
            <FaRegFolderClosed />
            <span>{folder.title}</span>
            <ChevronRight
              className={cn(
                `ml-auto transition-transform duration-200`,
                isActive ? 'rotate-90' : ''
              )}
            />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {folder.children.map((child: TrufosRequest | Folder) => {
            if (child.type === 'request') {
              return (
                <div key={child.id}>
                  <NavRequest request={child as TrufosRequest} />
                </div>
              );
            } else if (child.type === 'folder') {
              return (
                <div key={child.id}>
                  <NavFolder folder={child as Folder} />
                </div>
              );
            }
          })}
        </CollapsibleContent>
        <FolderDropdown folder={folder} />
      </SidebarMenuSub>
    </Collapsible>
  );
};

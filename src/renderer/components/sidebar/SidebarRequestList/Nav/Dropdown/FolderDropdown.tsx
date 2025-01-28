import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuAction } from '@/components/ui/sidebar';
import { MoreHorizontal } from 'lucide-react';
import { handleMouseEvent } from '@/util/callback-util';
import React from 'react';
import { Folder } from 'shim/objects/folder';
import { useCollectionActions } from '@/state/collectionStore';

export interface FolderDropdownProps {
  folder: Folder;
}

export const FolderDropdown = ({ folder }: FolderDropdownProps) => {
  const deleteFolder = useCollectionActions().deleteFolder;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction showOnHover>
          <MoreHorizontal />
          <span className="sr-only">More</span>
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 rounded-lg" side={'right'} align={'start'}>
        <DropdownMenuItem
          onClick={handleMouseEvent(() => deleteFolder(folder.id))}
          className="text-danger"
        >
          Delete Folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

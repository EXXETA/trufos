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
  folderId: Folder['id'];
}

export const FolderDropdown = ({ folderId }: FolderDropdownProps) => {
  const { addNewRequest } = useCollectionActions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction>
          <MoreHorizontal />
          <span className="sr-only">More</span>
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 rounded-lg" side={'right'} align={'start'}>
        <DropdownMenuItem
          onClick={handleMouseEvent(() =>
            addNewRequest((Math.random() + 1).toString(36).substring(7), folderId)
          )}
        >
          Add Request
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

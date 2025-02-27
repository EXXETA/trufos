import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuAction } from '@/components/ui/sidebar';
import { MoreHorizontal } from 'lucide-react';
import { handleMouseEvent } from '@/util/callback-util';
import { Folder } from 'shim/objects/folder';
import { useCollectionActions } from '@/state/collectionStore';
import { NamingModal } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/modals/NamingModal';

export interface FolderDropdownProps {
  folder: Folder;
}

export const FolderDropdown = ({ folder }: FolderDropdownProps) => {
  const { deleteFolder } = useCollectionActions();
  const [renameModalIsOpen, setRenameModalIsOpen] = useState(false);
  const [isCreateModal, setIsCreateModal] = useState<null | 'folder' | 'request'>(null);

  const openModal = (type: 'folder' | 'request' | null) => {
    setRenameModalIsOpen(true);
    setIsCreateModal(type);
  };

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction>
            <MoreHorizontal />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 rounded-lg" side="right" align="start">
          <DropdownMenuItem onClick={handleMouseEvent(() => openModal('request'))}>
            Add Request
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleMouseEvent(() => openModal('folder'))}>
            Add Folder
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleMouseEvent(() => openModal(null))}>
            Rename Folder
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-danger"
            onClick={handleMouseEvent(() => deleteFolder(folder.id))}
          >
            Delete Folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {renameModalIsOpen && (
        <NamingModal
          isOpen={renameModalIsOpen}
          trufosObject={folder}
          createType={isCreateModal}
          setOpen={setRenameModalIsOpen}
        />
      )}
    </div>
  );
};

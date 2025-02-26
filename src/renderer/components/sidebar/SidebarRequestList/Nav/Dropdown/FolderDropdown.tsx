import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuAction } from '@/components/ui/sidebar';
import { MoreHorizontal } from 'lucide-react';
import { handleMouseEvent } from '@/util/callback-util';
import { useState } from 'react';
import { Folder } from 'shim/objects/folder';
import { useCollectionActions } from '@/state/collectionStore';
import { RenameModal } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/modals/RenameModal';

export interface FolderDropdownProps {
  folder: Folder;
}

export const FolderDropdown = ({ folder }: FolderDropdownProps) => {
  const { addNewRequest, addNewFolder, deleteFolder } = useCollectionActions();
  const [renameModalIsOpen, setRenameModalIsOpen] = useState(false);
  return (
    <div>
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
              addNewRequest((Math.random() + 1).toString(36).substring(7), folder.id)
            )}
          >
            Add Request
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleMouseEvent(() =>
              addNewFolder((Math.random() + 1).toString(36).substring(7), folder.id)
            )}
          >
            Add Folder
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleMouseEvent(() => setRenameModalIsOpen(true))}>
            Rename Folder
          </DropdownMenuItem>
          <DropdownMenuItem
            className={'text-danger'}
            onClick={handleMouseEvent(() => deleteFolder(folder.id))}
          >
            Delete Folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameModal
        isOpen={renameModalIsOpen}
        trufosObject={folder}
        setOpen={(open) => setRenameModalIsOpen(open)}
      />
    </div>
  );
};

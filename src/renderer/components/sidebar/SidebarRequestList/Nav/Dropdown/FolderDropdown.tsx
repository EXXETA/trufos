import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuAction } from '@/components/ui/sidebar';
import { handleMouseEvent } from '@/util/callback-util';
import { Folder } from 'shim/objects/folder';
import { useCollectionActions } from '@/state/collectionStore';

import { MoreIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { CreatingItem } from '@/components/sidebar/SidebarRequestList/types';

export interface FolderDropdownProps {
  folder: Folder;
  onRename: () => void;
  onCreateItem: (item: CreatingItem) => void;
}

export const FolderDropdown = ({ folder, onRename, onCreateItem }: FolderDropdownProps) => {
  const { copyFolder, deleteFolder } = useCollectionActions();

  const openModal = (type: 'folder' | 'request') => {
    onCreateItem({ type, parentId: folder.id });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction className={cn('h6 w-6')}>
            <div className={cn('h6 w-6', 'rotate-90')}>
              <MoreIcon size={24} />
            </div>

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

          <DropdownMenuItem onClick={handleMouseEvent(onRename)}>Rename Folder</DropdownMenuItem>

          <DropdownMenuItem onClick={handleMouseEvent(() => copyFolder(folder.id))}>
            Copy Folder
          </DropdownMenuItem>

          <DropdownMenuItem
            className="text-danger"
            onClick={handleMouseEvent(() => deleteFolder(folder.id))}
          >
            Delete Folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

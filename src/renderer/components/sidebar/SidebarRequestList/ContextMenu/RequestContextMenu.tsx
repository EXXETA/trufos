import React from 'react';
import { CiMenuKebab } from 'react-icons/ci';
import { useCollectionActions } from '@/state/collectionStore';
import { handleMouseEvent } from '@/util/callback-util';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TrufosRequest } from 'shim/objects/request';

interface RequestContextMenuProps {
  requestId: TrufosRequest['id'];
}

export const RequestContextMenu = ({ requestId }: RequestContextMenuProps) => {
  const { deleteRequest } = useCollectionActions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="sidebar-row-menu flex h-4 w-4 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <CiMenuKebab className="cursor-pointer hover:fill-[var(--text-secondary)]" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-background">
        <DropdownMenuItem
          onClick={handleMouseEvent(() => deleteRequest(requestId))}
          className="text-danger"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

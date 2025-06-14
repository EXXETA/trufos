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
      <DropdownMenuTrigger>
        <CiMenuKebab className="cursor-pointer hover:fill-gray-900" />
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

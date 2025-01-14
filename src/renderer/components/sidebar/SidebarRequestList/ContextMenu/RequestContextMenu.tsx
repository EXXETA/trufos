import React from 'react';
import { CiMenuKebab } from 'react-icons/ci';
import { useRequestActions } from '@/state/requestStore';
import { handleMouseEvent } from '@/util/callback-util';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RequestContextMenuProps {
  index: number;
}

export const RequestContextMenu = ({ index }: RequestContextMenuProps) => {
  const { deleteRequest } = useRequestActions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <CiMenuKebab className="cursor-pointer hover:fill-gray-900" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className={'bg-background'}>
        <DropdownMenuItem
          onClick={handleMouseEvent(() => deleteRequest(index))}
          style={{ color: 'var(--text-danger)' }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

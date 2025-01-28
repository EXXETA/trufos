import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuAction } from '@/components/ui/sidebar';
import { MoreHorizontal } from 'lucide-react';
import { handleMouseEvent } from '@/util/callback-util';
import { useCollectionActions } from '@/state/collectionStore';
import React from 'react';
import { TrufosRequest } from 'shim/objects/request';

export interface RequestDropdownProps {
  request: TrufosRequest;
}

export const RequestDropdown = ({ request }: RequestDropdownProps) => {
  const deleteRequest = useCollectionActions().deleteRequest;
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
          onClick={handleMouseEvent(() => deleteRequest(request.id))}
          className="text-danger"
        >
          Delete Request
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

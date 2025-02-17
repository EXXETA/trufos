import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuAction } from '@/components/ui/sidebar';
import { MoreHorizontal } from 'lucide-react';
import { handleMouseEvent } from '@/util/callback-util';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import React from 'react';
import { TrufosRequest } from 'shim/objects/request';

export interface RequestDropdownProps {
  requestId: TrufosRequest['id'];
}

export const RequestDropdown = ({ requestId }: RequestDropdownProps) => {
  const deleteRequest = useCollectionActions().deleteRequest;
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction showOnHover={selectedRequestId !== requestId}>
          <MoreHorizontal />
          <span className="sr-only">More</span>
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 rounded-lg" side={'right'} align={'start'}>
        <DropdownMenuItem
          onClick={handleMouseEvent(() => deleteRequest(requestId))}
          className="text-danger"
        >
          Delete Request
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

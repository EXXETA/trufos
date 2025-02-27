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
import { useState } from 'react';
import { TrufosRequest } from 'shim/objects/request';
import { NamingModal } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/modals/NamingModal';

export interface RequestDropdownProps {
  request: TrufosRequest;
}

export const RequestDropdown = ({ request }: RequestDropdownProps) => {
  const { deleteRequest } = useCollectionActions();
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const [renameModalIsOpen, setRenameModalIsOpen] = useState(false);

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover={selectedRequestId !== request.id}>
            <MoreHorizontal />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 rounded-lg" side="right" align="start">
          <DropdownMenuItem onClick={handleMouseEvent(() => setRenameModalIsOpen(true))}>
            Rename Request
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleMouseEvent(() => deleteRequest(request.id))}
            className="text-danger"
          >
            Delete Request
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {renameModalIsOpen && (
        <NamingModal
          isOpen={renameModalIsOpen}
          trufosObject={request}
          createType={null}
          setOpen={setRenameModalIsOpen}
        />
      )}
    </div>
  );
};

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuAction } from '@/components/ui/sidebar';
import { handleMouseEvent } from '@/util/callback-util';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { TrufosRequest } from 'shim/objects/request';
import { cn } from '@/lib/utils';
import { MoreIcon } from '@/components/icons';

export interface RequestDropdownProps {
  request: TrufosRequest;
  onRename: () => void;
}

export const RequestDropdown = ({ request, onRename }: RequestDropdownProps) => {
  const { copyRequest, deleteRequest } = useCollectionActions();
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className={cn('h6 w-6')}
            showOnHover={selectedRequestId !== request.id}
          >
            <div className={cn('h6 w-6', 'rotate-90')}>
              <MoreIcon size={24} />
            </div>

            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-48 rounded-lg" side="right" align="start">
          <DropdownMenuItem onClick={handleMouseEvent(onRename)}>Rename Request</DropdownMenuItem>

          <DropdownMenuItem onClick={handleMouseEvent(() => copyRequest(request.id))}>
            Copy Request
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleMouseEvent(() => deleteRequest(request.id))}
            className="text-danger"
          >
            Delete Request
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

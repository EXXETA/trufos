import type { ReactElement } from 'react';
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
import { toast } from '@/components/ui/sonner';
import type { CurlOptions } from 'shim/event-service';

export interface RequestDropdownProps {
  request: TrufosRequest;
  onRename: () => void;
}

export const RequestDropdown = ({ request, onRename }: RequestDropdownProps): ReactElement => {
  const { copyItem, copyRequestAsCurl, deleteItem } = useCollectionActions();
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);

  const copyAsCurl = async (options: CurlOptions, message: string) => {
    if (await copyRequestAsCurl(request.id, options)) toast.success(message);
  };

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

          <DropdownMenuItem onClick={handleMouseEvent(() => copyItem(request.id))}>
            Copy Request
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleMouseEvent(() => copyAsCurl({}, 'cURL command copied'))}>
            Copy as cURL
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleMouseEvent(() =>
              copyAsCurl({ includeSecrets: true }, 'cURL command with secrets copied')
            )}
          >
            Copy as cURL with Secrets
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleMouseEvent(() => deleteItem(request.id))}
            className="text-danger"
          >
            Delete Request
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

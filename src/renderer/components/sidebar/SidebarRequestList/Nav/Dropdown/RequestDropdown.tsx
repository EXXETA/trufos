import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuAction } from '@/components/ui/sidebar';
import { handleMouseEvent } from '@/util/callback-util';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { useState } from 'react';
import { TrufosRequest } from 'shim/objects/request';
import { cn } from '@/lib/utils';
import { MoreIcon } from '@/components/icons';
import { InlineRenameInput } from '@/components/inlinerename';

export interface RequestDropdownProps {
  request: TrufosRequest;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
}

export const RequestDropdown = ({ request, isEditing, setIsEditing }: RequestDropdownProps) => {
  const { copyRequest, deleteRequest, renameRequest } = useCollectionActions();
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
          <DropdownMenuItem onClick={() => setIsEditing(true)}>Rename Request</DropdownMenuItem>

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

      {isEditing && (
        <InlineRenameInput
          initialValue={request.title} // use the current title
          autoEdit
          onSave={(newTitle) => {
            renameRequest(request.id, newTitle); // call the store action
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
          className="w-full"
        />
      )}
    </div>
  );
};

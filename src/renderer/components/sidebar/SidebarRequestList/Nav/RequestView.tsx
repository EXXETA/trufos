import { httpMethodColor } from '@/services/StyleHelper';
import { TrufosRequest } from 'shim/objects/request';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { handleMouseEvent } from '@/util/callback-util';
import { cn } from '@/lib/utils';
import { RequestDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/RequestDropdown';
import { getIndentation } from '@/components/sidebar/SidebarRequestList/Nav/indentation';
import { useState } from 'react';

export interface NavRequestProps {
  requestId: TrufosRequest['id'];
  depth?: number;
}

export const RequestView = ({ requestId, depth = 0 }: NavRequestProps) => {
  const { setSelectedRequest } = useCollectionActions();
  const request = useCollectionStore((state) => selectRequest(state, requestId));
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className={cn('hover:[background-color:#333333]')}>
      <span
        className={cn(
          'sidebar-request-list-item',
          'cursor-pointer',
          'flex',
          'py-3.5',
          'gap-2',
          'w-full',
          getIndentation(depth)
        )}
        onClick={handleMouseEvent(() => setSelectedRequest(requestId))}
      >
        <div className={cn('text-xs leading-3 font-bold', httpMethodColor(request.method))}>
          {request.method}
        </div>

        <p className={cn('text-xs leading-3', isEditing && 'hidden')}>
          {request.title ?? request.url}
        </p>

        <RequestDropdown request={request} isEditing={isEditing} setIsEditing={setIsEditing} />
      </span>
    </div>
  );
};

import { httpMethodColor } from '@/services/StyleHelper';
import { TrufosRequest } from 'shim/objects/request';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { handleMouseEvent } from '@/util/callback-util';
import { cn } from '@/lib/utils';
import { RequestDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/RequestDropdown';

export interface SidebarRequestListProps {
  requestId: TrufosRequest['id'];
}

export const RequestView = ({ requestId }: SidebarRequestListProps) => {
  const { setSelectedRequest } = useCollectionActions();
  const request = useCollectionStore((state) => selectRequest(state, requestId));

  return (
    <span
      className={cn(
        'sidebar-request-list-item',
        'cursor-pointer',
        'flex',
        'py-3.5',
        'ml-16',
        'gap-2',
        'w-full'
      )}
      onClick={handleMouseEvent(() => setSelectedRequest(requestId))}
    >
      <div className={cn('text-xs font-bold leading-3', httpMethodColor(request.method))}>
        {request.method}
      </div>

      <p className="text-xs leading-3">{request.title ?? request.url}</p>

      <RequestDropdown request={request} />
    </span>
  );
};

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
        'px-6',
        'gap-2'
      )}
      onClick={handleMouseEvent(() => setSelectedRequest(requestId))}
    >
      <div className={cn('text-xs leading-3 font-bold', httpMethodColor(request.method))}>
        {request.method}
      </div>

      <p className="text-xs leading-3">{request.title ?? request.url}</p>

      <RequestDropdown request={request} />
    </span>
  );
};

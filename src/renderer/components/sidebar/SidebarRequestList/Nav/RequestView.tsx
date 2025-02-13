import { httpMethodColor } from '@/services/StyleHelper';
import { TrufosRequest } from 'shim/objects/request';
import { useCollectionActions } from '@/state/collectionStore';
import { handleMouseEvent } from '@/util/callback-util';
import { cn } from '@/lib/utils';
import { RequestDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/RequestDropdown';

export interface SidebarRequestListProps {
  request: TrufosRequest;
}

export const RequestView = ({ request }: SidebarRequestListProps) => {
  const { setSelectedRequest } = useCollectionActions();

  return (
    <span
      key={request.id}
      className={cn(
        'sidebar-request-list-item',
        'cursor-pointer',
        'flex-row',
        'justify-between',
        'inline-flex',
        'py-2',
        'px-6',
        'gap-2'
      )}
      onClick={handleMouseEvent(() => setSelectedRequest(request.id))}
    >
      <div key={request.id} className={cn('font-bold', httpMethodColor(request.method))}>
        {request.method}
      </div>
      <p>{request.url}</p>
      <RequestDropdown request={request} />
    </span>
  );
};

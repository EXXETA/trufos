import { httpMethodColor } from '@/services/StyleHelper';
import { TrufosRequest } from 'shim/objects/request';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { handleMouseEvent } from '@/util/callback-util';
import { cn } from '@/lib/utils';
import { RequestDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/RequestDropdown';
import { getIndentation } from '@/util/indentation';

export interface NavRequestProps {
  requestId: TrufosRequest['id'];
  depth?: number;
}

export const RequestView = ({ requestId, depth = 0 }: NavRequestProps) => {
  const { setSelectedRequest } = useCollectionActions();
  const request = useCollectionStore((state) => selectRequest(state, requestId));

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
        <div className={cn('text-xs font-bold leading-3', httpMethodColor(request.method))}>
          {request.method}
        </div>

        <p className="text-xs leading-3">{request.title ?? request.url}</p>

        <RequestDropdown request={request} />
      </span>
    </div>
  );
};

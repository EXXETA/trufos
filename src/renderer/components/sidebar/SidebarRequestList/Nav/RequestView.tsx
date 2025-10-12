import { httpMethodColor } from '@/services/StyleHelper';
import { TrufosRequest } from 'shim/objects/request';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { handleMouseEvent } from '@/util/callback-util';
import { cn } from '@/lib/utils';
import { RequestDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/RequestDropdown';
import { SidebarMenuAction } from '@/components/ui/sidebar';
import { CloseIcon } from '@/components/icons';

export interface SidebarRequestListProps {
  requestId: TrufosRequest['id'];
}

export const RequestView = ({ requestId }: SidebarRequestListProps) => {
  const { setSelectedRequest, closeRequest } = useCollectionActions();
  const request = useCollectionStore((state) => selectRequest(state, requestId));
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);

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

      <div>
        <SidebarMenuAction
          className={cn('h-6 w-6', 'absolute right-8 top-2 md:right-11')}
          showOnHover={selectedRequestId !== request.id} // same hover behavior
          onClick={handleMouseEvent(() => {
            closeRequest(request.id); // <-- your custom handler
          })}
        >
          <div className={cn('h6 w-6', 'rotate-90')}>
            <CloseIcon size={24} />
          </div>
          <span className="sr-only">Close</span>
        </SidebarMenuAction>
      </div>

      <RequestDropdown request={request} />
    </span>
  );
};

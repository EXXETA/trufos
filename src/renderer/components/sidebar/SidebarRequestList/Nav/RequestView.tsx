import { httpMethodColor } from '@/services/StyleHelper';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TrufosRequest } from 'shim/objects/request';
import { useCollectionStore } from '@/state/collectionStore';
import { handleMouseEvent } from '@/util/callback-util';
import { cn } from '@/lib/utils';
import { RequestDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/RequestDropdown';

export interface SidebarRequestListProps {
  request: TrufosRequest;
}
export const RequestView = ({ request }: SidebarRequestListProps) => {
  const selectedRequestIndex = useCollectionStore().selectedRequestIndex;
  const setSelectedRequest = useCollectionStore().setSelectedRequest;

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
        'gap-2',
        selectedRequestIndex === request.id ? 'selected' : ''
      )}
      onClick={handleMouseEvent(() => setSelectedRequest(request.id))}
    >
      <div className={cn('font-bold', httpMethodColor(request.method))}>{request.method}</div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="truncate flex-1">{request.url}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{request.url}</p>
        </TooltipContent>
      </Tooltip>
      <RequestDropdown />
    </span>
  );
};

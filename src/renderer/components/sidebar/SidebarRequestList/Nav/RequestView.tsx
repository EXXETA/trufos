import { httpMethodColor } from '@/services/StyleHelper';
import { TrufosRequest } from 'shim/objects/request';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { handleMouseEvent } from '@/util/callback-util';
import { cn } from '@/lib/utils';
import { RequestDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/RequestDropdown';
import { getIndentation } from '@/components/sidebar/SidebarRequestList/Nav/indentation';

export interface NavRequestProps {
  requestId: TrufosRequest['id'];
  depth?: number;
}

export const RequestView = ({ requestId, depth = 0 }: NavRequestProps) => {
  const { setSelectedRequest } = useCollectionActions();
  const request = useCollectionStore((state) => selectRequest(state, requestId));

  return (
    <div className={cn('hover:bg-[#333333]')}>
      <span
        className={cn(
          'sidebar-request-list-item',
          'cursor-pointer',
          'flex',
          'min-w-0',
          'py-3.5',
          'gap-2',
          'w-full',
          getIndentation(depth)
        )}
        onClick={handleMouseEvent(() => setSelectedRequest(requestId))}
      >
        <div className={cn('text-xs leading-3 font-normal', httpMethodColor(request.method))}>
          {request.method}
        </div>

        <p className="font-lato truncate text-xs leading-3 text-[var(--text-secondary)]">
          {request.title ?? request.url.base}
        </p>

        <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <RequestDropdown request={request} />
        </div>
      </span>
    </div>
  );
};

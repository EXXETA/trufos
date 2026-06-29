import { httpMethodColor } from '@/services/StyleHelper';
import { TrufosRequest } from 'shim/objects/request';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { handleMouseEvent } from '@/util/callback-util';
import { cn } from '@/lib/utils';
import { RequestDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/RequestDropdown';
import { getIndentation } from '@/components/sidebar/SidebarRequestList/Nav/indentation';
import { useState } from 'react';
import { InlineRename } from '@/components/shared/InlineRename';

export interface NavRequestProps {
  requestId: TrufosRequest['id'];
  depth?: number;
}

export const RequestView = ({ requestId, depth = 0 }: NavRequestProps) => {
  const { setSelectedRequest, renameRequest } = useCollectionActions();
  const request = useCollectionStore((state) => selectRequest(state, requestId)!);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className={cn('group hover:bg-sidebar-accent')}>
      <span
        className={cn(
          'sidebar-request-list-item',
          'relative',
          'cursor-pointer',
          'flex',
          'items-center',
          'min-w-0',
          isEditing ? 'py-2.5' : 'py-3.5',
          'gap-3',
          'w-full',
          getIndentation(depth)
        )}
        onClick={handleMouseEvent(() => setSelectedRequest(requestId))}
      >
        <div
          className={cn('shrink-0 text-xs leading-3 font-normal', httpMethodColor(request.method))}
        >
          {request.method}
        </div>

        {isEditing ? (
          <InlineRename
            initialValue={request.title || request.url.base}
            onSave={(newName) => {
              const trimmed = newName.trim();
              if (trimmed && trimmed !== (request.title || request.url.base)) {
                renameRequest(requestId, trimmed);
              }
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
            inputClassName="h-6 text-xs"
          />
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center">
              <span className="font-lato flex-1 truncate text-xs leading-3 text-[var(--text-secondary)]">
                {request.title ?? request.url.base}
              </span>
            </div>

            <div
              className="sidebar-row-menu flex h-4 w-4 flex-shrink-0 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <RequestDropdown request={request} onRename={() => setIsEditing(true)} />
            </div>
          </>
        )}
      </span>
    </div>
  );
};

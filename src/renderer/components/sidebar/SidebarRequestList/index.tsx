import './index.css';
import { httpMethodColor } from '@/services/StyleHelper';
import { RequestBodyType } from 'shim/objects/request';
import React, { useEffect } from 'react';
import { IpcPushStream } from '@/lib/ipc-stream';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { handleMouseEvent } from '@/util/callback-util';
import { RequestContextMenu } from '@/components/sidebar/SidebarRequestList/ContextMenu/RequestContextMenu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const SidebarRequestList = () => {
  const { setSelectedRequest } = useCollectionActions();
  const { selectedRequestId } = useCollectionStore();
  const requestEditor = useCollectionStore((state) => state.requestEditor);
  const collectionItems = useCollectionStore((state) => state.items);
  const request = useCollectionStore(selectRequest);
  const requests = Array.from(collectionItems.values()).filter((item) => item.type === 'request');

  useEffect(() => {
    if (requestEditor == null) {
      return;
    } else if (request?.body?.type === RequestBodyType.TEXT && request?.id != null) {
      IpcPushStream.open(request)
        .then((stream) => IpcPushStream.collect(stream))
        .then(requestEditor.setValue.bind(requestEditor));
    } else {
      requestEditor.setValue('');
    }
  }, [request?.id, requestEditor]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto -mx-6" id="sidebar-request-list">
      {requests.map((request) => (
        <span
          key={request.id}
          className={joinClassNames(
            'sidebar-request-list-item',
            'cursor-pointer',
            'flex-row',
            'justify-between',
            'inline-flex',
            'hover:bg-gray-600',
            'py-2',
            'px-6',
            'gap-2',
            selectedRequestId === request.id ? 'selected' : ''
          )}
          onClick={handleMouseEvent(() => setSelectedRequest(request.id))}
        >
          <div className={joinClassNames('font-bold', httpMethodColor(request.method))}>
            {request.method}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="truncate flex-1">{request.url}</div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{request.url}</p>
            </TooltipContent>
          </Tooltip>
          <div className="items-center justify-center flex">
            <RequestContextMenu requestId={request.id} />
          </div>
        </span>
      ))}
    </div>
  );
};

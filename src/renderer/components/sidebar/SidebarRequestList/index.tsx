import { httpMethodColor } from '@/services/StyleHelper';
import { RequestBodyType } from 'shim/objects/request';
import React, { useEffect } from 'react';
import { IpcPushStream } from '@/lib/ipc-stream';
import { useRequestActions, useRequestStore } from '@/state/requestStore';
import { handleMouseEvent } from '@/util/callback-util';
import './index.css';
import { RequestContextMenu } from '@/components/sidebar/SidebarRequestList/ContextMenu/RequestContextMenu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const SidebarRequestList = () => {
  const { setSelectedRequest } = useRequestActions();
  const requestEditor = useRequestStore((state) => state.requestEditor);
  const requests = useRequestStore((state) => state.requests);
  const selectedRequestIndex = useRequestStore((state) => state.selectedRequestIndex);
  const request = requests[selectedRequestIndex];

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
    <div
      className="flex flex-1 flex-col overflow-y-auto -mx-6"
      id="sidebar-request-list"
      onClick={handleMouseEvent(() => setSelectedRequest(-1))}
    >
      {requests.map((request, index) => (
        <span
          key={index}
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
            selectedRequestIndex === index ? 'selected' : ''
          )}
          onClick={handleMouseEvent(() => setSelectedRequest(index))}
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
            <RequestContextMenu index={index} />
          </div>
        </span>
      ))}
    </div>
  );
};

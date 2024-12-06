import { httpMethodColor } from '@/services/StyleHelper';
import { RequestBodyType } from 'shim/objects/request';
import { FaTimes } from 'react-icons/fa';
import { MouseEvent, useEffect } from 'react';
import { IpcPushStream } from '@/lib/ipc-stream';
import { useRequestActions, useRequestStore } from '@/state/requestStore';
import './index.css';

export const SidebarRequestList = () => {
  const { setSelectedRequest, deleteRequest } = useRequestActions();
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

  const handleDeleteClick = async (event: MouseEvent, index: number) => {
    event.stopPropagation();
    await deleteRequest(index);
  };

  return (
    <div className="w-full flex flex-col" id="sidebar-request-list">
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
            'p-2',
            'gap-2',
            selectedRequestIndex === index ? 'selected' : ''
          )}
          onClick={() => setSelectedRequest(index)}
        >
          <div className={joinClassNames('', 'font-bold', httpMethodColor(request.method))}>
            {request.method}
          </div>
          <div className="truncate tooltip flex-1">
            {request.url}
            <div className="tooltip-text">{request.url}</div>
          </div>
          <div className="items-center justify-center flex">
            <FaTimes
              onClick={(event) => handleDeleteClick(event, index)}
              className="cursor-pointer"
            />
          </div>
        </span>
      ))}
    </div>
  );
};

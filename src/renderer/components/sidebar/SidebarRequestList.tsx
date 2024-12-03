import { httpMethodColor } from '@/services/StyleHelper';
import { RequestBodyType } from 'shim/objects/request';
import { FaTimes } from 'react-icons/fa';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { MouseEvent, useCallback, useEffect } from 'react';
import { IpcPushStream } from '@/lib/ipc-stream';
import { useRequestStore } from '@/state/requestStore';

const eventService = RendererEventService.instance;

export const SidebarRequestList = () => {
  const { requestEditor, requests, selectedRequestIndex, setSelectedRequest, deleteRequest } =
    useRequestStore();
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
  }, [request, requestEditor]);

  const handleRowClick = async (index: number) => {
    if (request != null) {
      await eventService.saveRequest(request, requestEditor?.getValue());
    }
    setSelectedRequest(index);
  };

  const handleDeleteClick = useCallback(
    async (event: MouseEvent, index: number) => {
      event.stopPropagation();
      const request = requests[index];
      deleteRequest(index);
      if (request.id != null) {
        await eventService.deleteObject(request);
      }
    },
    [deleteRequest, requests]
  );

  return (
    <table className="w-full table-fixed">
      <tbody>
        {requests.map((request, index) => (
          <tr
            key={index}
            className={`cursor-pointer hover:bg-gray-600 ${selectedRequestIndex == index ? 'bg-gray-500' : ''}`}
            onClick={() => handleRowClick(index)}
          >
            <td className={'p-2 font-bold w-20 ' + httpMethodColor(request.method)}>
              {request.method}
            </td>
            <td className="p-2 truncate tooltip">
              {request.url}
              <div className="tooltip-text">{request.url}</div>
            </td>
            <td className="p-2 items-end w-8">
              <FaTimes
                onClick={(event) => handleDeleteClick(event, index)}
                className="cursor-pointer"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/state/store';
import { deleteRequest, setSelectedRequest } from '@/state/requestsSlice';
import { httpMethodColor } from '@/services/StyleHelper';
import { RequestBodyType, RufusRequest } from 'shim/objects/request';
import { FaTimes } from 'react-icons/fa';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { MouseEvent, useCallback, useEffect } from 'react';
import { IpcPushStream } from '@/lib/ipc-stream';

interface SidebarRequestListProps {
  requests: RufusRequest[];
}

const eventService = RendererEventService.instance;

export const SidebarRequestList = ({ requests = [] }: SidebarRequestListProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const selectedRequestIndex = useSelector((state: RootState) => state.requests.selectedRequest);
  const requestEditor = useSelector((state: RootState) => state.requests.requestEditor);
  const request: RufusRequest | undefined = requests[selectedRequestIndex];

  useEffect(() => {
    if (requestEditor == null) {
      return;
    } else if (request?.body?.type === RequestBodyType.TEXT) {
      IpcPushStream.open(request)
        .then((stream) => IpcPushStream.collect(stream))
        .then((content) => {
          console.log(content);
          requestEditor.setValue(content);
        });
    } else {
      requestEditor.setValue('');
    }
  }, [request?.id, requestEditor]);

  const handleRowClick = useCallback(
    async (index: number) => {
      if (request != null) {
        await eventService.saveRequest(request, requestEditor?.getValue());
      }
      dispatch(setSelectedRequest(index));
    },
    [dispatch, requestEditor, requests, request]
  );

  const handleDeleteClick = useCallback(
    async (event: MouseEvent, index: number) => {
      const request = requests[index];
      if (request == null) {
        return;
      }

      dispatch(deleteRequest(index));
      if (request.id != null) {
        await eventService.deleteObject(request);
      }
    },
    [dispatch, requests]
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

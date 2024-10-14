import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/state/store';
import { deleteRequest, setSelectedRequest } from '@/state/requestsSlice';
import { httpMethodColor } from '@/services/StyleHelper';
import { RequestBodyType, RufusRequest } from 'shim/objects/request';
import { FaTimes } from 'react-icons/fa'; // Importing cross icon
import { RendererEventService } from '@/services/event/renderer-event-service';
import { MouseEvent, useCallback, useEffect } from 'react';

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
    const model = requestEditor?.getModel();
    if (model == null) {
      return;
    }

    if (request?.body?.type === RequestBodyType.TEXT) {
      eventService.loadTextRequestBody(request).then((content) => model.setValue(content));
    } else {
      model.setValue('');
    }
  }, [request?.id, requestEditor?.getModel()]);

  const handleRowClick = useCallback(async (index: number) => {
    if (request != null) {
      await eventService.saveRequest(request, requestEditor?.getValue());
    }
    dispatch(setSelectedRequest(index));
    console.info('Selected request:', requests[index]);
  }, [dispatch, requestEditor, requests, request]);

  const handleDeleteClick = useCallback(async (event: MouseEvent, index: number) => {
    const request = requests[index];
    if (request == null) {
      return;
    }

    dispatch(deleteRequest(index));
    if (request.id != null) {
      await eventService.deleteObject(request);
    }
    console.info('Request deleted:', request);
  }, [dispatch, requests]);

  return (
    <table className="w-full table-auto">
      <tbody>
      {requests.map((request, index) => (
        <tr
          key={index}
          className={`cursor-pointer hover:bg-gray-600 ${selectedRequestIndex === index ? 'bg-gray-500' : ''}`}
          onClick={() => handleRowClick(index)}
        >
          <td className={'p-2 font-bold ' + httpMethodColor(request.method)}>{request.method}</td>
          <td className="p-2">{request.url}</td>
          <td className="p-2 text-right">
            <FaTimes onClick={(event) => handleDeleteClick(event, index)}
                     className="cursor-pointer ml-2" />
          </td>
        </tr>
      ))}
      </tbody>
    </table>
  );
};

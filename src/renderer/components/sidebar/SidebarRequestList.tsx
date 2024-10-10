import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/state/store';
import { deleteRequest, setSelectedRequest } from '@/state/requestsSlice';
import { httpMethodColor } from '@/services/StyleHelper';
import { RufusRequest } from 'shim/objects/request';
import { FaTimes } from 'react-icons/fa'; // Importing cross icon
import { RendererEventService } from '@/services/event/renderer-event-service';

interface SidebarRequestListProps {
  requests: RufusRequest[];
}

const eventService = RendererEventService.instance;

export const SidebarRequestList = ({ requests = [] }: SidebarRequestListProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const selectedRequest = useSelector((state: RootState) => state.requests.selectedRequest);

  const handleRowClick = (index: number) => {
    dispatch(setSelectedRequest(index));
    setSelectedRequest(index);
  };

  const handleDeleteClick = async (event: React.MouseEvent, index: number) => {
    const request = requests[index];
    if (request == null) {
      return;
    }

    dispatch(deleteRequest(index));
    if (request.id != null) {
      await eventService.deleteObject(request);
    }
    console.info('Request deleted', request);
  };

  return (
    <table className="w-full table-auto">
      <tbody>
      {requests.map((request, index) => (
        <tr
          key={index}
          className={`cursor-pointer hover:bg-gray-600 ${selectedRequest == index ? 'bg-gray-500' : ''}`}
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

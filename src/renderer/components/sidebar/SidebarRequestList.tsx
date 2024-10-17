import {useDispatch, useSelector} from "react-redux";
import {AppDispatch, RootState} from "@/state/store";
import {setSelectedRequest, deleteRequest} from "@/state/requestsSlice";
import {httpMethodColor} from "@/services/StyleHelper";
import {RufusRequest} from "shim/objects/request";
import {FaTimes} from 'react-icons/fa'; // Importing cross icon

interface SidebarRequestListProps {
  requests: RufusRequest[];
}

export const SidebarRequestList = ({ requests = []}: SidebarRequestListProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const selectedRequest = useSelector((state: RootState) => state.requests.selectedRequest);

  const handleRowClick = (index: number) => {
    dispatch(setSelectedRequest(index));
    setSelectedRequest(index);
  };

  const handleDeleteClick = (event: React.MouseEvent, index: number) => {
    dispatch(deleteRequest(index));
    console.log(`Request ${index} deleted`);
  };

  return (
      <table className="w-full table-fixed">
        <tbody>
        {requests.map((request, index) => (
            <tr
                key={index}
                className={`cursor-pointer hover:bg-gray-600 ${selectedRequest == index ? 'bg-gray-500' : ''}`}
                onClick={() => handleRowClick(index)}
            >
              <td className={'p-2 font-bold w-20 ' + httpMethodColor(request.method)}>{request.method}</td>
              <td className="p-2 truncate tooltip">
                {request.url}
                <div className="tooltip-text">{request.url}</div>
              </td>
              <td className="p-2 items-end w-8">
              <FaTimes onClick={(event) => handleDeleteClick(event, index)} className="cursor-pointer" />
              </td>
            </tr>
        ))}
        </tbody>
      </table>
  );
};

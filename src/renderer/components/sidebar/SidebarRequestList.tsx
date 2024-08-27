import {Request} from "shim/request";
import {useDispatch, useSelector} from "react-redux";
import {AppDispatch, RootState} from "@/state/store";
import {setSelectedRequest} from "@/state/requestsSlice";
import {httpMethodColor} from "@/services/StyleHelper";


interface SidebarRequestListProps {
  requests: Request[];
}

export const SidebarRequestList = ({ requests = []}: SidebarRequestListProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const selectedRequest = useSelector((state: RootState) => state.requests.selectedRequest);

  const handleRowClick = (index: number) => {
    dispatch(setSelectedRequest(index));
    setSelectedRequest(index);
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
            </tr>
        ))}
        </tbody>
      </table>
  );
};

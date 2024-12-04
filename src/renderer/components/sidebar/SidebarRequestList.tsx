import { httpMethodColor } from '@/services/StyleHelper';
import { RequestBodyType } from 'shim/objects/request';
import { FaTimes } from 'react-icons/fa';
import { MouseEvent, useEffect } from 'react';
import { IpcPushStream } from '@/lib/ipc-stream';
import { useRequestActions, useRequestStore } from '@/state/requestStore';

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
  }, [request, requestEditor]);

  const handleDeleteClick = async (event: MouseEvent, index: number) => {
    event.stopPropagation();
    await deleteRequest(index);
  };

  return (
    <table className="w-full table-fixed">
      <tbody>
        {requests.map((request, index) => (
          <tr
            key={index}
            className={`cursor-pointer hover:bg-gray-600 ${selectedRequestIndex == index ? 'bg-gray-500' : ''}`}
            onClick={() => setSelectedRequest(index)}
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

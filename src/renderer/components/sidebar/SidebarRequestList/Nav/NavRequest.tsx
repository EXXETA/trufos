import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { useCollectionStore, useCollectionActions } from '@/state/collectionStore';
import { useEffect } from 'react';
import { IpcPushStream } from '@/lib/ipc-stream';
import { SidebarMenuItem, SidebarMenuSubButton, SidebarMenuSubItem } from '@/components/ui/sidebar';
import { RequestView } from '@/components/sidebar/SidebarRequestList/Nav/RequestView';

interface NavRequestProps {
  request: TrufosRequest;
}

export const NavRequest = ({ request }: NavRequestProps) => {
  const { setSelectedRequest } = useCollectionActions();
  const requestEditor = useCollectionStore((state) => state.requestEditor);
  const selectedRequestIndex = useCollectionStore((state) => state.selectedRequestIndex);

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
    <SidebarMenuSubItem key={request.id}>
      <SidebarMenuSubButton asChild>
        <SidebarMenuItem>
          <RequestView request={request} />
        </SidebarMenuItem>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
};

import { TrufosRequest } from 'shim/objects/request';
import { SidebarMenuItem, SidebarMenuSubButton, SidebarMenuSubItem } from '@/components/ui/sidebar';
import { RequestView } from '@/components/sidebar/SidebarRequestList/Nav/RequestView';
import { useCollectionStore } from '@/state/collectionStore';

interface NavRequestProps {
  request: TrufosRequest;
}

export const NavRequest = ({ request }: NavRequestProps) => {
  const selectedRequest = useCollectionStore((state) => state.selectedRequestId);
  return (
    <SidebarMenuSubItem key={request.id} >
      <SidebarMenuSubButton asChild isActive={request.id === selectedRequest}>
        <SidebarMenuItem>
          <RequestView request={request} />
        </SidebarMenuItem>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
};

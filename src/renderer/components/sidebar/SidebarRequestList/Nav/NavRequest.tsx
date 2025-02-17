import { TrufosRequest } from 'shim/objects/request';
import { SidebarMenuItem, SidebarMenuSubButton, SidebarMenuSubItem } from '@/components/ui/sidebar';
import { RequestView } from '@/components/sidebar/SidebarRequestList/Nav/RequestView';
import { useCollectionStore } from '@/state/collectionStore';

interface NavRequestProps {
  requestId: TrufosRequest['id'];
}

export const NavRequest = ({ requestId }: NavRequestProps) => {
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={requestId === selectedRequestId}>
        <SidebarMenuItem>
          <RequestView requestId={requestId} />
        </SidebarMenuItem>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
};

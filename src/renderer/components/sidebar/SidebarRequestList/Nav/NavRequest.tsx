import { TrufosRequest } from 'shim/objects/request';
import { SidebarMenuItem, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { RequestView } from '@/components/sidebar/SidebarRequestList/Nav/RequestView';
import { useCollectionStore } from '@/state/collectionStore';

interface NavRequestProps {
  requestId: TrufosRequest['id'];
}

export const NavRequest = ({ requestId }: NavRequestProps) => {
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);

  return (
    <SidebarMenuItem className={'overflow-x-hidden hover:[background-color:#333333]'}>
      <SidebarMenuSubButton asChild isActive={requestId === selectedRequestId}>
        <RequestView requestId={requestId} />
      </SidebarMenuSubButton>
    </SidebarMenuItem>
  );
};

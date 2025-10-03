import { TrufosRequest } from 'shim/objects/request';
import { SidebarMenuItem, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { RequestView } from '@/components/sidebar/SidebarRequestList/Nav/RequestView';
import { useCollectionStore } from '@/state/collectionStore';

interface NavRequestProps {
  requestId: TrufosRequest['id'];
  depth?: number;
}

export const NavRequest = ({ requestId, depth = 0 }: NavRequestProps) => {
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const isHighlighted = selectedRequestId === requestId;

  return (
    <SidebarMenuItem
      className={`overflow-x-hidden hover:bg-divider ${isHighlighted && 'bg-divider'}`}
    >
      <SidebarMenuSubButton asChild isActive={requestId === selectedRequestId}>
        <RequestView requestId={requestId} depth={depth} />
      </SidebarMenuSubButton>
    </SidebarMenuItem>
  );
};

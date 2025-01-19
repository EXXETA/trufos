import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { TrufosRequest } from 'shim/objects/request';
import { RequestView } from '@/components/sidebar/SidebarRequestList/Nav/RequestView';

interface RootRequestProps {
  request: TrufosRequest;
}

export const RootRequest = ({ request }: RootRequestProps) => {
  return (
    <SidebarMenuItem key={request.id}>
      <SidebarMenuButton asChild>
        <RequestView request={request} />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

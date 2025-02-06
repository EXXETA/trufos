import { TrufosRequest } from 'shim/objects/request';
import { SidebarMenuItem, SidebarMenuSubButton, SidebarMenuSubItem } from '@/components/ui/sidebar';
import { RequestView } from '@/components/sidebar/SidebarRequestList/Nav/RequestView';

interface NavRequestProps {
  request: TrufosRequest;
}

export const NavRequest = ({ request }: NavRequestProps) => {
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

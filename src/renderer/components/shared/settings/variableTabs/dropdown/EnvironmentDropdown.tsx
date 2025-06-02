import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuAction } from '@/components/ui/sidebar';
import { MoreHorizontal } from 'lucide-react';

export interface RequestDropdownProps {
  environmentKey: string;
  selected: boolean;
  hover: boolean;
}

export const EnvironmentDropdown = ({ environmentKey, selected, hover }: RequestDropdownProps) => {
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover={!selected && !hover}>
            <MoreHorizontal />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 rounded-lg" side="right" align="start">
          <DropdownMenuItem>Rename Request</DropdownMenuItem>
          <DropdownMenuItem className="text-danger">Delete Request</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

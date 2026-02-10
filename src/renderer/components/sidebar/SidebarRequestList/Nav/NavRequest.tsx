import { TrufosRequest } from 'shim/objects/request';
import { SidebarMenuItem, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { RequestView } from '@/components/sidebar/SidebarRequestList/Nav/RequestView';
import { useCollectionStore } from '@/state/collectionStore';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface NavRequestProps {
  requestId: TrufosRequest['id'];
  depth?: number;
}

export const NavRequest = ({ requestId, depth = 0 }: NavRequestProps) => {
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const isHighlighted = selectedRequestId === requestId;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: requestId,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative cursor-grab active:cursor-grabbing"
    >
      <SidebarMenuItem
        className={`hover:bg-divider overflow-x-hidden ${isHighlighted && 'bg-divider'}`}
      >
        <SidebarMenuSubButton asChild isActive={requestId === selectedRequestId}>
          <RequestView requestId={requestId} depth={depth} />
        </SidebarMenuSubButton>
      </SidebarMenuItem>
    </div>
  );
};

import { useEffect, useRef } from 'react';
import { TrufosRequest } from 'shim/objects/request';
import { SidebarMenuItem, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { RequestView } from '@/components/sidebar/SidebarRequestList/Nav/RequestView';
import { useCollectionStore } from '@/state/collectionStore';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ItemClickHandler } from '@/components/sidebar/SidebarRequestList/types';
import { cn } from '@/lib/utils';

interface NavRequestProps {
  requestId: TrufosRequest['id'];
  depth?: number;
  onItemClick: ItemClickHandler;
  isSelected?: boolean;
}

export const NavRequest = ({
  requestId,
  depth = 0,
  onItemClick,
  isSelected = false,
}: NavRequestProps) => {
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const isHighlighted = selectedRequestId === requestId;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: requestId,
  });

  // dnd-kit's setNodeRef is a callback ref with no readable `.current`, so a
  // separate ref is needed to scroll the row into view once it's revealed.
  const rowRef = useRef<HTMLDivElement>(null);
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    rowRef.current = node;
  };

  useEffect(() => {
    if (isHighlighted) {
      rowRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isHighlighted]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setRefs}
      style={style}
      {...attributes}
      {...listeners}
      className="relative cursor-grab active:cursor-grabbing"
    >
      <SidebarMenuItem
        className={cn(
          'group hover:bg-divider overflow-x-hidden',
          isHighlighted && 'bg-divider',
          isSelected && 'bg-accent-primary/10'
        )}
      >
        <SidebarMenuSubButton asChild isActive={requestId === selectedRequestId}>
          <RequestView requestId={requestId} depth={depth} onItemClick={onItemClick} />
        </SidebarMenuSubButton>
      </SidebarMenuItem>
    </div>
  );
};

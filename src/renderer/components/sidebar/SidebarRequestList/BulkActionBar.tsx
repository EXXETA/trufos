import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LuCopyPlus, LuEraser, LuTrash2 } from 'react-icons/lu';

export interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onDuplicate: () => void;
  onDeleteClick: () => void;
}

export const BulkActionBar = ({
  count,
  onClear,
  onDuplicate,
  onDeleteClick,
}: BulkActionBarProps) => {
  if (count === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2',
        'border-divider border-b px-5 py-2',
        'bg-sidebar-accent',
        '-mx-6'
      )}
    >
      <span className="text-xs font-medium text-(--text-secondary)">
        {count} {count === 1 ? 'item' : 'items'} selected
      </span>

      <div className="flex items-center gap-4">
        <Button
          variant="secondary"
          size="icon"
          type="button"
          aria-label="Clear selection"
          onClick={onClear}
        >
          <LuEraser size={16} />
        </Button>

        <Button
          variant="secondary"
          size="icon"
          type="button"
          aria-label="Duplicate selected items"
          onClick={onDuplicate}
        >
          <LuCopyPlus size={16} />
        </Button>

        <Button
          variant="secondary"
          size="icon"
          type="button"
          className="text-danger"
          aria-label="Delete selected items"
          onClick={onDeleteClick}
        >
          <LuTrash2 size={16} />
        </Button>
      </div>
    </div>
  );
};

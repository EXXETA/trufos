import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
        'bg-sidebar-accent'
      )}
    >
      <span className="text-xs font-medium text-(--text-secondary)">
        {count} {count === 1 ? 'item' : 'items'} selected
      </span>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" type="button" onClick={onClear}>
          Clear
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={onDuplicate}>
          Duplicate
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="text-danger"
          onClick={onDeleteClick}
        >
          Delete
        </Button>
      </div>
    </div>
  );
};

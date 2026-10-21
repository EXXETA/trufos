import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { InheritedHeader } from 'shim/collection-model';

export interface InheritedHeaderRowsProps {
  /** The inherited headers, see `useInheritedHeaders()`. */
  headers: InheritedHeader[];
  /**
   * Called with the key of an inherited header that is enabled or disabled. If not
   * given, the headers cannot be disabled, as for folders.
   */
  onEnabledChange?: (key: string, isEnabled: boolean) => void;
}

/** Describes where an inherited header comes from. */
function getSourceLabel({ source }: InheritedHeader): string {
  return source.type === 'collection' ? 'from Collection' : `from folder "${source.title}"`;
}

/**
 * The read-only table rows of the headers that a request or folder inherits from the collection
 * and its folders. Only whether they are sent can be changed.
 */
export const InheritedHeaderRows = ({ headers, onEnabledChange }: InheritedHeaderRowsProps) =>
  headers.map((entry, index) => {
    const { header, isOverridden, isDisabled } = entry;
    return (
      <TableRow
        key={index}
        className={cn('text-text-secondary', isDisabled && 'text-text-disabled')}
        title={isOverridden ? 'Overridden by a header with the same name' : undefined}
      >
        <TableCell className="w-1/3 break-all">
          <span className={cn(isOverridden && 'line-through')}>{header.key}</span>
          <span className="block text-xs">{getSourceLabel(entry)}</span>
        </TableCell>
        <TableCell className={cn('w-full break-all', isOverridden && 'line-through')}>
          {header.value}
        </TableCell>
        <TableCell className="w-16 text-right">
          <div className="flex items-center justify-center gap-2">
            {onEnabledChange == null ? (
              <span className="h-4 w-4" />
            ) : (
              <Checkbox
                checked={!isDisabled}
                aria-label={`Send inherited header ${header.key}`}
                onCheckedChange={(checked) => onEnabledChange(header.key, checked === true)}
              />
            )}
            {/* takes the place of the delete button of the own headers */}
            <span className="h-6 w-6" />
          </div>
        </TableCell>
      </TableRow>
    );
  });

import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { AutomaticHeader, AutomaticHeaderKey, InheritedHeader } from 'shim/collection-model';

export interface DerivedHeaderRowsProps {
  /** The headers Trufos sets itself, see `getAutomaticHeaders()`. Only requests have them. */
  automatic?: AutomaticHeader[];
  /** The inherited headers, see `useInheritedHeaders()`. */
  inherited: InheritedHeader[];
  /**
   * Called with the key of a header that is enabled or disabled. If not given, the headers cannot
   * be disabled, as for folders. Automatic headers can only be disabled if they allow it.
   */
  onEnabledChange?: (key: string, isEnabled: boolean) => void;
}

/** How an automatic header is shown. */
interface AutomaticHeaderLabels {
  name: string;
  /** Describes where the value comes from. */
  origin: string;
  /** Shown in italics instead of a value that is only known when the request is sent. */
  pendingValue: string;
  /** Explains the pending value, shown below it. */
  pendingNote?: string;
}

const AUTOMATIC_HEADER_LABELS: Record<AutomaticHeaderKey, AutomaticHeaderLabels> = {
  [AutomaticHeaderKey.CONTENT_TYPE]: {
    name: 'Content-Type',
    origin: 'from body type',
    pendingValue: 'multipart/form-data',
    pendingNote: 'boundary added when sent',
  },
  [AutomaticHeaderKey.CONTENT_LENGTH]: {
    name: 'Content-Length',
    origin: 'from body file',
    pendingValue: 'file size',
    pendingNote: 'calculated when sent',
  },
  [AutomaticHeaderKey.AUTHORIZATION]: {
    name: 'Authorization',
    origin: 'from Auth tab',
    pendingValue: 'generated when sent',
  },
  [AutomaticHeaderKey.USER_AGENT]: {
    name: 'User-Agent',
    origin: 'set by Trufos',
    pendingValue: 'Trufos/<version>',
    pendingNote: 'set when sent',
  },
};

/** Describes where an inherited header comes from. */
function getSourceLabel({ source }: InheritedHeader): string {
  return source.type === 'collection' ? 'from Collection' : `from folder "${source.title}"`;
}

interface DerivedHeaderRowProps {
  name: string;
  /** The value, or a description of it in italics if it is only known when the request is sent. */
  value: string | { pending: string };
  /** Shown small below the value, e.g. when the header is sent. */
  note?: string;
  origin: string;
  isOverridden: boolean;
  isDisabled: boolean;
  /** Called when the header is enabled or disabled. It cannot be disabled if not given. */
  onEnabledChange?: (isEnabled: boolean) => void;
}

const DerivedHeaderRow = ({
  name,
  value,
  note,
  origin,
  isOverridden,
  isDisabled,
  onEnabledChange,
}: DerivedHeaderRowProps) => (
  <TableRow
    className={cn('text-text-secondary', isDisabled && 'text-text-disabled')}
    title={isOverridden ? 'Overridden by a header with the same name' : undefined}
  >
    <TableCell className="w-1/3 break-all">
      <span className={cn(isOverridden && 'line-through')}>{name}</span>
      <span className="block text-xs">{origin}</span>
    </TableCell>
    <TableCell className="w-full">
      <span className={cn(isOverridden && 'line-through')}>
        {typeof value === 'string' ? (
          <span className="break-all">{value}</span>
        ) : (
          <span className="italic">{value.pending}</span>
        )}
      </span>
      {note != null && <span className="block text-xs">{note}</span>}
    </TableCell>
    <TableCell className="w-16 text-right">
      <div className="flex items-center justify-center gap-2">
        {onEnabledChange == null ? (
          <span className="h-4 w-4" />
        ) : (
          <Checkbox
            checked={!isDisabled}
            aria-label={`Send header ${name}`}
            onCheckedChange={(checked) => onEnabledChange(checked === true)}
          />
        )}
        {/* takes the place of the delete button of the own headers */}
        <span className="h-6 w-6" />
      </div>
    </TableCell>
  </TableRow>
);

/**
 * The read-only table rows of the headers that a request or folder sends without defining them:
 * the automatic ones, then the inherited ones. Only whether they are sent can be changed.
 */
export const DerivedHeaderRows = ({
  automatic = [],
  inherited,
  onEnabledChange,
}: DerivedHeaderRowsProps) => (
  <>
    {automatic.map(({ key, value, canDisable, isConditional, isOverridden, isDisabled }) => {
      const labels = AUTOMATIC_HEADER_LABELS[key];
      return (
        <DerivedHeaderRow
          key={`automatic-${key}`}
          name={labels.name}
          value={value ?? { pending: labels.pendingValue }}
          note={
            isConditional
              ? 'only if the body is not empty'
              : value == null
                ? labels.pendingNote
                : undefined
          }
          origin={labels.origin}
          isOverridden={isOverridden}
          isDisabled={isDisabled}
          onEnabledChange={
            canDisable && onEnabledChange != null
              ? (isEnabled) => onEnabledChange(key, isEnabled)
              : undefined
          }
        />
      );
    })}
    {inherited.map((entry, index) => (
      <DerivedHeaderRow
        key={`inherited-${index}`}
        name={entry.header.key}
        value={entry.header.value}
        origin={getSourceLabel(entry)}
        isOverridden={entry.isOverridden}
        isDisabled={entry.isDisabled}
        onEnabledChange={
          onEnabledChange == null
            ? undefined
            : (isEnabled) => onEnabledChange(entry.header.key, isEnabled)
        }
      />
    ))}
  </>
);

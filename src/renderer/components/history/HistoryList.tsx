import { SidebarContent } from '@/components/ui/sidebar';
import { getDateTimeText } from '@/util/format-util';
import { httpMethodColor } from '@/services/StyleHelper';
import { cn } from '@/lib/utils';
import {
  selectHistoryEntries,
  selectSelectedHistoryId,
  useHistoryActions,
  useHistoryStore,
} from '@/state/historyStore';
import { HistoryEntrySummary } from 'shim/history';
import { OutcomeBadge } from './OutcomeBadge';

/**
 * Lists the request history of the current collection in the sidebar, newest first. Selecting an
 * entry shows it in the main area, see {@link HistoryEntryView}. The count and the clear action are
 * part of the sidebar header, see {@link SidebarHeaderBar}.
 */
export const HistoryList = () => {
  const entries = useHistoryStore(selectHistoryEntries);
  const selectedId = useHistoryStore(selectSelectedHistoryId);
  const { select } = useHistoryActions();

  return (
    <SidebarContent className="tabs-scrollbar -mr-6 -ml-6 flex-1 overflow-x-hidden overflow-y-auto">
      {entries.length === 0 ? (
        <p className="text-text-secondary px-6 text-xs">No requests sent yet.</p>
      ) : (
        <ul aria-label="Request history">
          {entries.map((entry) => (
            <li key={entry.id}>
              <HistoryListItem
                entry={entry}
                isSelected={entry.id === selectedId}
                onSelect={() => void select(entry.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </SidebarContent>
  );
};

interface HistoryListItemProps {
  entry: HistoryEntrySummary;
  isSelected: boolean;
  onSelect: () => void;
}

const HistoryListItem = ({ entry, isSelected, onSelect }: HistoryListItemProps) => (
  <button
    type="button"
    aria-current={isSelected}
    onClick={onSelect}
    className={cn(
      'hover:bg-divider flex w-full cursor-pointer flex-col gap-1 px-6 py-2 text-left',
      isSelected && 'bg-divider'
    )}
  >
    <span className="flex min-w-0 items-baseline gap-2">
      <span className={cn('shrink-0 text-xs', httpMethodColor(entry.method))}>{entry.method}</span>
      <span className="truncate text-xs">{entry.requestTitle}</span>
    </span>
    <span className="text-text-secondary truncate text-xs" title={entry.url}>
      {entry.url}
    </span>
    <span className="flex min-w-0 gap-2 text-xs">
      <OutcomeBadge outcome={entry.outcome} />
      <span className="text-text-secondary shrink-0">{getDateTimeText(entry.timestamp)}</span>
    </span>
  </button>
);

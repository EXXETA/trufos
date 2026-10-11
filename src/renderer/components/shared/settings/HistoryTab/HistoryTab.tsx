import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getHttpStatusColorClass } from '@/components/mainWindow/responseStatus/ResponseStatusFormatter';
import { httpMethodColor } from '@/services/StyleHelper';
import { cn } from '@/lib/utils';
import {
  selectHistoryEntries,
  selectSelectedHistoryEntry,
  selectSelectedHistoryId,
  useHistoryActions,
  useHistoryStore,
} from '@/state/historyStore';
import { HistoryEntrySummary } from 'shim/history';
import { HistoryEntryDetail } from './HistoryEntryDetail';

/**
 * The request history of the current session: every sent request with its response or error.
 * The list only holds summaries; an entry's headers, bodies and script output are loaded when it
 * is selected.
 */
export const HistoryTab = () => {
  const entries = useHistoryStore(selectHistoryEntries);
  const selectedId = useHistoryStore(selectSelectedHistoryId);
  const selectedEntry = useHistoryStore(selectSelectedHistoryEntry);
  const { refresh, select, clear } = useHistoryActions();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex h-full min-h-0">
      <aside className="border-border flex w-80 shrink-0 flex-col border-r">
        <div className="flex shrink-0 items-center justify-between px-4 py-2">
          <span className="text-text-secondary text-xs">
            {entries.length} {entries.length === 1 ? 'request' : 'requests'} in this session
          </span>
          <Button variant="ghost" size="sm" disabled={entries.length === 0} onClick={clear}>
            Clear
          </Button>
        </div>
        {entries.length === 0 ? (
          <p className="text-text-secondary px-4 text-sm">No requests sent yet.</p>
        ) : (
          <ul aria-label="Request history" className="min-h-0 flex-1 overflow-y-auto">
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
      </aside>

      <section aria-label="Request details" className="min-w-0 flex-1">
        {selectedEntry != null ? (
          <HistoryEntryDetail key={selectedEntry.id} entry={selectedEntry} />
        ) : (
          <p className="text-text-secondary p-4 text-sm">
            {selectedId == null
              ? 'Select a request to see exactly what was sent and received.'
              : 'Loading…'}
          </p>
        )}
      </section>
    </div>
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
      'hover:bg-background-secondary flex w-full cursor-pointer flex-col gap-0.5 px-4 py-2 text-left',
      isSelected && 'bg-background-secondary'
    )}
  >
    <span className="flex min-w-0 items-baseline gap-2">
      <span className={cn('shrink-0 text-xs font-bold', httpMethodColor(entry.method))}>
        {entry.method}
      </span>
      <span className="truncate text-sm">{entry.requestTitle}</span>
    </span>
    <span className="text-text-secondary truncate text-xs" title={entry.url}>
      {entry.url}
    </span>
    <span className="flex gap-2 text-xs">
      {entry.status != null ? (
        <span className={getHttpStatusColorClass(entry.status)}>{entry.status}</span>
      ) : (
        <span className="error truncate">{entry.error ?? 'No response'}</span>
      )}
      <span className="text-text-secondary">{new Date(entry.timestamp).toLocaleTimeString()}</span>
    </span>
  </button>
);

import { ArrowUpRight, X } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { ResponseTabs } from '@/components/mainWindow/bodyTabs/OutputTabs';
import { httpMethodColor } from '@/lib/http-method-color';
import { cn } from '@/lib/utils';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import {
  selectSelectedHistoryEntry,
  useHistoryActions,
  useHistoryStore,
} from '@/state/historyStore';
import { useViewActions } from '@/state/viewStore';
import { useTemporaryModel } from '@/hooks/useTemporaryModel';
import { HistoryEntry, summarizeHistoryOutcome } from 'shim/history';
import { ReceivedResponse } from 'shim/objects/response';
import { HistoryRequestTabs } from './HistoryRequestTabs';
import { OutcomeBadge } from './OutcomeBadge';

/**
 * Shows the selected entry of the request history read-only, laid out like the request editor:
 * the request exactly as it was sent next to the response it received.
 */
export function HistoryEntryView() {
  const entry = useHistoryStore(selectSelectedHistoryEntry);

  if (entry == null) {
    return (
      <div className="text-text-secondary flex h-full items-center justify-center text-sm">
        Loading…
      </div>
    );
  }

  return (
    <section aria-label="History entry" className="grid h-full grid-rows-[auto_1fr] p-6">
      <HistoryTopBar entry={entry} />
      <div className="grid h-full grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-6 xl:grid-cols-2 xl:grid-rows-1">
        <HistoryRequestTabs className="min-h-0 min-w-0" entry={entry} />
        {entry.outcome.type === 'response' ? (
          <HistoryResponse key={entry.id} response={entry.outcome.response} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-sm">
            <OutcomeBadge outcome={summarizeHistoryOutcome(entry.outcome)} />
          </div>
        )}
      </div>
    </section>
  );
}

const HistoryTopBar = ({ entry }: { entry: HistoryEntry }) => {
  const requestExists = useCollectionStore((state) => state.requests.has(entry.requestId));
  const { setSelectedRequest } = useCollectionActions();
  const { setSidebarView } = useViewActions();
  const { deselect } = useHistoryActions();

  const goToRequest = () => {
    setSidebarView('requests');
    void setSelectedRequest(entry.requestId);
  };

  return (
    <div className="mb-6 flex items-center gap-6">
      <div className="flex h-10 w-full min-w-0">
        <span
          className={cn(
            'border-border flex min-w-25.5 shrink-0 items-center rounded-l-full border py-2 pr-2 pl-4',
            httpMethodColor(entry.method)
          )}
        >
          {entry.method}
        </span>
        <span
          aria-label="URL"
          title={entry.url}
          className="border-border bg-background-secondary flex min-w-0 grow items-center rounded-r-full border border-l-0 px-3"
        >
          <span className="truncate select-text">{entry.url}</span>
        </span>
      </div>

      <IconButton
        disabled={!requestExists}
        onClick={goToRequest}
        aria-label="Go to request"
        title={requestExists ? 'Go to request' : 'The request no longer exists'}
      >
        <ArrowUpRight />
      </IconButton>

      <IconButton onClick={deselect} aria-label="Close history entry" title="Close">
        <X />
      </IconButton>
    </div>
  );
};

const HistoryResponse = ({ response }: { response: ReceivedResponse }) => {
  const model = useTemporaryModel();
  return <ResponseTabs className="min-h-0 min-w-0" response={response} model={model} />;
};

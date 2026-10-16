import { MainTopBar } from '@/components/mainWindow/MainTopBar';
import { MainBody } from '@/components/mainWindow/MainBody';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { EmptyWildWest } from '@/assets/EmptyWildWest';
import { MouseEvent, useCallback } from 'react';
import { selectSidebarView, useViewStore } from '@/state/viewStore';
import { selectSelectedHistoryId, useHistoryStore } from '@/state/historyStore';
import { HistoryEntryView } from '@/components/history/HistoryEntryView';

export function RequestWindow() {
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const { addNewRequest } = useCollectionActions();
  const sidebarView = useViewStore(selectSidebarView);
  const selectedHistoryId = useHistoryStore(selectSelectedHistoryId);

  const handleAddNewRequest = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      addNewRequest();
    },
    [addNewRequest]
  );

  // the selected history entry is shown while the sidebar lists the history
  if (sidebarView === 'history' && selectedHistoryId != null) {
    return <HistoryEntryView />;
  }

  if (selectedRequestId == null) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6">
        <EmptyWildWest />
        <span className="mt-2 text-center">
          <a
            className="text-accent-primary mr-1 cursor-pointer underline"
            onClick={handleAddNewRequest}
          >
            Create
          </a>
          or select a request to get started
        </span>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-rows-[auto_1fr] p-6">
      <MainTopBar />
      <MainBody />
    </div>
  );
}

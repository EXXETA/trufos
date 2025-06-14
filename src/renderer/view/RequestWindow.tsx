import { MainTopBar } from '@/components/mainWindow/MainTopBar';
import { MainBody } from '@/components/mainWindow/MainBody';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { EmptyWildWest } from '@/assets/EmptyWildWest';
import { MouseEvent, useCallback } from 'react';

export function RequestWindow() {
  const requestSelected = useCollectionStore((state) => state.selectedRequestId != null);
  const { addNewRequest } = useCollectionActions();
  const handleAddNewRequest = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      addNewRequest('');
    },
    [addNewRequest]
  );

  if (!requestSelected) {
    return (
      <div className="flex flex-auto flex-col items-center justify-center p-6">
        <EmptyWildWest />
        <span className="mt-2 text-center">
          <a className="mr-1 cursor-pointer text-cyan-400 underline" onClick={handleAddNewRequest}>
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

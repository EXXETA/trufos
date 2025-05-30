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
      <div className="flex flex-col flex-auto p-6 items-center justify-center">
        <EmptyWildWest />
        <span className="text-center mt-2">
          <a className="mr-1 text-cyan-400 underline cursor-pointer" onClick={handleAddNewRequest}>
            Create
          </a>
          or select a request to get started
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-rows-[auto_1fr] p-6">
      <MainTopBar />
      <MainBody />
    </div>
  );
}

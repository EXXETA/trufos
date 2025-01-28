import { MainTopBar } from '@/components/mainWindow/MainTopBar';
import { MainBody } from '@/components/mainWindow/MainBody';
import { useCollectionStore } from '@/state/collectionStore';
import { EmptyWildWest } from '@/assets/EmptyWildWest';
import { MouseEvent, useCallback } from 'react';

export function RequestWindow() {
  const { addNewRequest, selectedRequest } = useCollectionStore();
  const handleAddNewRequest = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      addNewRequest('');
    },
    [addNewRequest]
  );

  if (!selectedRequest) {
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
    <div className={'flex flex-col flex-auto p-6'}>
      <MainTopBar />
      <MainBody />
    </div>
  );
}

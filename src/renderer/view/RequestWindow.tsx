import { MainTopBar } from '@/components/mainWindow/MainTopBar';
import { MainBody } from '@/components/mainWindow/MainBody';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { EmptyWildWest } from '@/assets/EmptyWildWest';
import { MouseEvent, useCallback, useEffect, useRef } from 'react';
import { registerGetRequest } from '@/lib/monaco/models';
import { setRequestTextBody, setScriptContent } from '@/state/helper/collectionUtil';
import { ScriptType } from 'shim/scripting';

export function RequestWindow() {
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const requests = useCollectionStore((state) => state.requests);
  const { addNewRequest } = useCollectionActions();

  // Register the getRequest callback once so onWillDisposeModel can resolve requests.
  const requestsRef = useRef(requests);
  requestsRef.current = requests;
  useEffect(() => {
    registerGetRequest((id) => requestsRef.current.get(id));
  }, []);

  // Load content into models when the selected request changes.
  // Models are already created by setSelectedRequest in the store before this
  // effect runs, so getBodyModel / getScriptModel are safe to call here.
  useEffect(() => {
    if (selectedRequestId == null) return;
    const request = requestsRef.current.get(selectedRequestId);
    void setRequestTextBody(selectedRequestId, request);
    void setScriptContent(selectedRequestId, request, ScriptType.PRE_REQUEST);
  }, [selectedRequestId]);

  const handleAddNewRequest = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      addNewRequest();
    },
    [addNewRequest]
  );

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

import { MainTopBar } from '@/components/mainWindow/MainTopBar';
import { MainBody } from '@/components/mainWindow/MainBody';
import {
  selectAllRequests,
  selectRequest,
  useRequestActions,
  useRequestStore,
} from '@/state/requestStore';
import { EmptyWildWest } from '@/assets/EmptyWildWest';
import { MouseEvent, useCallback, useEffect, useRef } from 'react';
import { RendererEventService } from '@/services/event/renderer-event-service';

const eventService = RendererEventService.instance;

export function MainWindow() {
  const requestSelected = useRequestStore((state) => selectRequest(state) != null);
  const allRequests = useRequestStore(selectAllRequests);
  const allRequestsRef = useRef(allRequests);
  const requestEditor = useRequestStore((state) => state.requestEditor);
  const reqEditorRef = useRef(requestEditor);
  const { updateRequest } = useRequestActions();
  const { addNewRequest } = useRequestActions();
  const handleAddNewRequest = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      addNewRequest();
    },
    [addNewRequest]
  );

  useEffect(() => {
    allRequestsRef.current = allRequests;
  }, [allRequests]);

  useEffect(() => {
    reqEditorRef.current = requestEditor;
  }, [requestEditor]);

  useEffect(() => {
    const handleSaveBeforeClose = async () => {
      const draftRequests = allRequestsRef.current.filter((request) => request.draft);
      for (const draftRequest of draftRequests) {
        console.debug(`Saving draft request: ${draftRequest.id}`);
        await eventService.saveRequest(draftRequest, reqEditorRef.current?.getValue());
        updateRequest(await eventService.saveChanges(draftRequest), true);
      }
      window.electron.ipcRenderer.send('save-before-close-response');
    };
    window.electron.ipcRenderer.on('save-before-close', handleSaveBeforeClose);

    return () => {
      window.electron.ipcRenderer.removeListener('save-before-close', handleSaveBeforeClose);
    };
  }, []);

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
    <div className={'flex flex-col flex-auto p-6'}>
      {/*<Header />*/}
      <MainTopBar />
      <MainBody />
    </div>
  );
}

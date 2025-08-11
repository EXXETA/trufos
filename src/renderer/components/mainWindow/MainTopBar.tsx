import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { RequestMethod } from 'shim/objects/request-method';
import { useErrorHandler } from '@/components/ui/use-toast';
import { HttpService } from '@/services/http/http-service';
import { HttpMethodSelect } from './mainTopBar/HttpMethodSelect';
import { UrlInput } from './mainTopBar/UrlInput';
import { SendButton } from './mainTopBar/SendButton';
import { SaveButton } from './mainTopBar/SaveButton';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { useResponseActions } from '@/state/responseStore';
import { ArrowRight, Loader2 } from 'lucide-react';
import { showError } from '@/error/errorHandler';
import { REQUEST_MODEL } from '@/lib/monaco/models';
import { useGlobalHotkeys } from '@/hooks/useGlobalHotkeys';
import { NamingModal } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/modals/NamingModal';
import { Collection } from 'shim/objects/collection';

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

export function MainTopBar() {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'request' as 'request' | 'folder',
  });

  const { updateRequest } = useCollectionActions();
  const { addResponse } = useResponseActions();
  const request = useCollectionStore(selectRequest);
  const collection = useCollectionStore((state) => state.collection);
  const selectedHttpMethod = request?.method;
  const url = request?.url;

  const handleUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    setHasError(false);

    updateRequest({ url: event.target.value });
  };

  const handleHttpMethodChange = (method: RequestMethod) => updateRequest({ method });

  const sendRequest = useCallback(
    useErrorHandler(async () => {
      if (request == null) return;
      if (!request.url || !request.method) {
        setHasError(true);

        throw new Error('Missing URL or HTTP method');
      }

      try {
        setIsLoading(true);
        await eventService.saveRequest(request, REQUEST_MODEL.getValue());

        const response = await httpService.sendRequest(request);
        addResponse(request.id, response);
      } catch (error) {
        showError(error);
      } finally {
        setIsLoading(false);
      }
    }),
    [request, addResponse]
  );

  const saveRequest = useCallback(
    useErrorHandler(async () => {
      if (request == null) return;

      console.info('Saving request:', request);
      await eventService.saveRequest(request, REQUEST_MODEL.getValue());
      updateRequest(await eventService.saveChanges(request), true);
    }),
    [request]
  );

  const openRequestModal = () => setModalState({ isOpen: true, type: 'request' });

  useGlobalHotkeys({
    onSendRequest: sendRequest,
    onSaveRequest: saveRequest,
    onCreateNewRequest: openRequestModal,
  });

  useEffect(() => {
    if (request?.url && request?.method) {
      setHasError(false);
    }
  }, [request]);

  return (
    <>
      <div className="mb-[24px] flex gap-6">
        <div className="relative flex w-full">
          <HttpMethodSelect
            selectedHttpMethod={selectedHttpMethod}
            onHttpMethodChange={handleHttpMethodChange}
          />

          <UrlInput url={url} onUrlChange={handleUrlChange} hasError={hasError} />

          <SaveButton isDisabled={!request?.draft} onClick={saveRequest} />
        </div>

        <SendButton onClick={sendRequest} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight />}
        </SendButton>
      </div>

      {modalState.isOpen && (
        <NamingModal
          isOpen={modalState.isOpen}
          trufosObject={collection as Collection}
          createType={modalState.type}
          setOpen={(open) => setModalState({ isOpen: open, type: modalState.type })}
        />
      )}
    </>
  );
}

import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { RequestMethod } from 'shim/objects/request-method';
import { useErrorHandler } from '@/components/ui/use-toast';
import { HttpService } from '@/services/http/http-service';
import { HttpMethodSelect } from './mainTopBar/HttpMethodSelect';
import { UrlInput } from './mainTopBar/UrlInput';
import { SendButton } from './mainTopBar/SendButton';
import { SaveButton } from './mainTopBar/SaveButton';
import { cn } from '@/lib/utils';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { useResponseActions } from '@/state/responseStore';

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

export function MainTopBar() {
  const [hasError, setHasError] = useState(false);

  const { updateRequest } = useCollectionActions();
  const { addResponse } = useResponseActions();
  const requestEditor = useCollectionStore((state) => state.requestEditor);
  const request = useCollectionStore(selectRequest);
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

      await eventService.saveRequest(request, requestEditor?.getValue());

      const response = await httpService.sendRequest(request);
      addResponse(request.id, response);
    }),
    [request, requestEditor, addResponse]
  );

  const saveRequest = useCallback(
    useErrorHandler(async () => {
      if (request == null) return;

      // save request draft with the current editor content
      console.info('Saving request:', request);
      await eventService.saveRequest(request, requestEditor?.getValue());

      // override existing request with the saved draft
      updateRequest(await eventService.saveChanges(request), true);
    }),
    [request, requestEditor]
  );

  // useEffect to reset error state when URL and method are valid
  useEffect(() => {
    if (request?.url && request?.method) {
      setHasError(false);
    }
  }, [request]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      //isSaveShortcut is true if save combination is recorded
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
      //if save combination is pressed and request is in draft mode, perform save
      if (isSaveShortcut && request?.draft) {
        event.preventDefault();
        saveRequest();
      }
    };
    //add keyboard event listener
    window.addEventListener('keydown', handleKeyDown);
    //cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveRequest]);

  return (
    <div className={cn('flex mb-[24px] gap-6')}>
      <div className="flex w-full relative">
        <HttpMethodSelect
          selectedHttpMethod={selectedHttpMethod}
          onHttpMethodChange={handleHttpMethodChange}
        />

        <UrlInput url={url} onUrlChange={handleUrlChange} hasError={hasError} />

        <SaveButton isDisabled={!request?.draft} onClick={saveRequest} />
      </div>

      <SendButton onClick={sendRequest} />
    </div>
  );
}

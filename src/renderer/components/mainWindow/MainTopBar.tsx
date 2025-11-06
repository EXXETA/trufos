import { useCallback, useEffect, useState } from 'react';
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
import { TrufosURL } from 'shim/objects/url';

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

export function MainTopBar() {
  const [isLoading, setIsLoading] = useState(false);

  const { updateRequest } = useCollectionActions();
  const { addResponse } = useResponseActions();
  const request = useCollectionStore(selectRequest);
  const { url, method } = request;

  const handleUrlChange = (url: TrufosURL) => updateRequest({ url });
  const handleHttpMethodChange = (method: RequestMethod) => updateRequest({ method });

  const sendRequest = useCallback(
    useErrorHandler(async () => {
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

      // save request draft with the current editor content
      console.info('Saving request:', request);
      await eventService.saveRequest(request, REQUEST_MODEL.getValue());

      // override existing request with the saved draft
      updateRequest(await eventService.saveChanges(request), true);
    }),
    [request]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // isSaveShortcut is true if save combination is recorded
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
      // if save combination is pressed and request is in draft mode, perform save
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
    <div className="mb-6 flex gap-6">
      <div className="relative flex w-full">
        <HttpMethodSelect selectedHttpMethod={method} onHttpMethodChange={handleHttpMethodChange} />
        <UrlInput url={url} onChange={handleUrlChange} />
        <SaveButton isDisabled={!request?.draft} onClick={saveRequest} />
      </div>

      <SendButton onClick={sendRequest} disabled={isLoading}>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight />}
      </SendButton>
    </div>
  );
}

import { ChangeEvent, useCallback } from 'react';
import { RequestMethod } from 'shim/objects/request-method';
import { useErrorHandler } from '@/components/ui/use-toast';
import { HttpService } from '@/services/http/http-service';
import { HttpMethodSelect } from './mainTopBar/HttpMethodSelect';
import { UrlInput } from './mainTopBar/UrlInput';
import { SendButton } from './mainTopBar/SendButton';
import { SaveButton } from './mainTopBar/SaveButton';
import { cn } from '@/lib/utils';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useRequestStore } from '@/state/requestsSlice';
import { useResponseStore } from '@/state/responsesSlice';

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

export function MainTopBar() {
  const {
    updateRequest,
    requestEditor,
    selectedRequest: requestIndex,
    requests,
  } = useRequestStore();
  const { addResponse } = useResponseStore();
  const request = requests[requestIndex];
  const selectedHttpMethod = request?.method;
  const url = request?.url;

  const handleUrlChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (request == null) return;

      updateRequest({
        index: requestIndex,
        request: { ...request, url: event.target.value, draft: true },
      });
    },
    [request]
  );

  const handleHttpMethodChange = useCallback(
    (method: RequestMethod) => {
      if (request == null) return;

      updateRequest({
        index: requestIndex,
        request: { ...request, method, draft: true },
      });
    },
    [request]
  );

  const sendRequest = useCallback(
    useErrorHandler(async () => {
      if (request == null) return;
      if (!request.url || !request.method) {
        throw new Error('Missing URL or HTTP method');
      }

      await eventService.saveRequest(request, requestEditor?.getValue());

      const response = await httpService.sendRequest(request);
      addResponse({ requestId: request.id, ...response });
    }),
    [request, requestEditor]
  );

  const saveRequest = useCallback(
    useErrorHandler(async () => {
      if (request == null) return;

      // save request draft with the current editor content
      console.info('Saving request:', request);
      await eventService.saveRequest(request, requestEditor?.getValue());

      // override existing request with the saved draft
      updateRequest({
        index: requestIndex,
        request: await eventService.saveChanges(request),
      });
    }),
    [request, requestEditor]
  );

  return (
    <div className={cn('flex mb-[24px]')}>
      <HttpMethodSelect
        selectedHttpMethod={selectedHttpMethod}
        onHttpMethodChange={handleHttpMethodChange}
      />
      <UrlInput url={url} onUrlChange={handleUrlChange} />
      <SendButton onClick={sendRequest} />
      <SaveButton disabled={!request?.draft} onClick={saveRequest} />
    </div>
  );
}

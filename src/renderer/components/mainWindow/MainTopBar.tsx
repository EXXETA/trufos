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
import { selectRequest, useRequestStore } from '@/state/requestStore';
import { useResponseStore } from '@/state/responsStore';

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

export function MainTopBar() {
  const { updateRequest, requestEditor } = useRequestStore();
  const { addResponse } = useResponseStore();
  const request = useRequestStore(selectRequest);
  const selectedHttpMethod = request?.method;
  const url = request?.url;

  const handleUrlChange = (event: ChangeEvent<HTMLInputElement>) =>
    updateRequest({
      url: event.target.value,
      draft: true,
    });

  const handleHttpMethodChange = (method: RequestMethod) => updateRequest({ method, draft: true });

  const sendRequest = useCallback(
    useErrorHandler(async () => {
      if (request == null) return;
      if (!request.url || !request.method) {
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

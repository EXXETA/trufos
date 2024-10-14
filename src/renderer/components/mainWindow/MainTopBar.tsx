import { ChangeEvent, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/state/store';
import { editor } from 'monaco-editor';
import { RequestMethod } from 'shim/objects/requestMethod';
import { RufusRequest } from 'shim/objects/request';
import { updateRequest } from '@/state/requestsSlice';
import { useErrorHandler } from '@/components/ui/use-toast';
import { HttpService } from '@/services/http/http-service';
import { HttpMethodSelect } from './mainTopBar/HttpMethodSelect';
import { UrlInput } from './mainTopBar/UrlInput';
import { SendButton } from './mainTopBar/SendButton';
import { SaveButton } from './mainTopBar/SaveButton';
import { cn } from '@/lib/utils';
import { RufusResponse } from 'shim/objects/response';
import { RendererEventService } from '@/services/event/renderer-event-service';

export type RequestProps = {
  onResponse: (response: RufusResponse) => Promise<void>;
}

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

export function MainTopBar({ onResponse }: RequestProps) {
  const dispatch = useDispatch();
  const requestEditor = useSelector<RootState>(state => state.requests.requestEditor) as editor.ICodeEditor | undefined;
  const requestIndex = useSelector<RootState, number>(state => state.requests.selectedRequest);
  const requests = useSelector<RootState, RufusRequest[]>(state => state.requests.requests);
  const request = requests[requestIndex];
  const selectedHttpMethod = request?.method;
  const url = request?.url;

  const handleUrlChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (request == null) return;

    dispatch(updateRequest({
      index: requestIndex,
      request: { ...request, url: event.target.value, draft: true }
    }));
  }, [request]);

  const handleHttpMethodChange = useCallback((method: RequestMethod) => {
    if (request == null) return;

    console.info(`Changing HTTP method from ${request.method} to ${method}`);
    dispatch(updateRequest({
      index: requestIndex,
      request: { ...request, method, draft: true }
    }));
  }, [request]);

  const sendRequest = useCallback(useErrorHandler(async () => {
    if (request == null) return;
    if (!request.url || !request.method) {
      throw new Error('Missing URL or HTTP method');
    }

    await eventService.saveRequest(request, requestEditor?.getValue());

    // Send the request and pass the response to the onResponse callback
    await onResponse(await httpService.sendRequest(request));
  }), [request, requestEditor, onResponse]);

  const saveRequest = useCallback(useErrorHandler(async () => {
    if (request == null) return;

    // save request draft with the current editor content
    console.info('Saving request:', request);
    await eventService.saveRequest(request, requestEditor?.getValue());

    // override existing request with the saved draft
    dispatch(updateRequest({
      index: requestIndex,
      request: await eventService.saveChanges(request)
    }));
  }), [request, requestEditor]);

  return (
    <div className={cn('flex mb-[24px]')}>
      <HttpMethodSelect selectedHttpMethod={selectedHttpMethod}
                        onHttpMethodChange={handleHttpMethodChange} />
      <UrlInput url={url} onUrlChange={handleUrlChange} />
      <SendButton onClick={sendRequest} />
      <SaveButton change={request?.draft} onClick={saveRequest} />
    </div>
  );
}

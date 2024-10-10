import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/state/store';
import { editor } from 'monaco-editor';
import { RequestMethod } from 'shim/objects/requestMethod';
import { RequestBody, RequestBodyType, RufusRequest } from 'shim/objects/request';
import { setSelectedRequest, updateRequest } from '@/state/requestsSlice';
import { useErrorHandler } from '@/components/ui/use-toast';
import { HttpService } from '@/services/http/http-service';
import { HttpMethodSelect } from './mainTopBar/HttpMethodSelect';
import { UrlInput } from './mainTopBar/UrlInput';
import { SendButton } from './mainTopBar/SendButton';
import { SaveButton } from './mainTopBar/SaveButton';
import { cn } from '@/lib/utils';
import { HttpHeaders } from 'shim/headers';
import { RufusResponse } from 'shim/objects/response';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { RufusHeader } from 'shim/objects/headers';

export type RequestProps = {
  onResponse: (response: RufusResponse) => Promise<void>;
}

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

export function MainTopBar({ onResponse }: RequestProps) {
  const dispatch = useDispatch();
  const [url, setUrl] = React.useState('');
  const [selectedHttpMethod, setSelectedHttpMethod] = React.useState<RequestMethod>(RequestMethod.get);
  const requestEditor = useSelector<RootState>(state => state.view.requestEditor) as editor.ICodeEditor | undefined;
  const selectedRequest = useSelector<RootState, number>(state => state.requests.selectedRequest);
  const requestList = useSelector<RootState, RufusRequest[]>(state => state.requests.requests);
  const headersState = useSelector<RootState, RufusHeader[]>(state => state.headers.headers);

  React.useEffect(() => {
    if (selectedRequest < requestList.length) {
      setSelectedHttpMethod(requestList[selectedRequest].method);
      setUrl(requestList[selectedRequest].url);
    } else if (requestList.length > 0) {
      setSelectedHttpMethod(requestList[0].method);
      setUrl(requestList[0].url);
      dispatch(setSelectedRequest(0));
    }
  }, [selectedRequest, requestList.length]);

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    setUrl(newUrl);
    dispatch(updateRequest({
      index: selectedRequest,
      request: { ...requestList[selectedRequest], url: newUrl, draft: true }
    }));
  };

  const handleHttpMethodChange = (method: RequestMethod) => {
    console.info(`Changing HTTP method from ${requestList[selectedRequest].method} to ${method}`);
    setSelectedHttpMethod(method);
    dispatch(updateRequest({
      index: selectedRequest,
      request: { ...requestList[selectedRequest], method, draft: true }
    }));
  };

  const sendRequest = React.useCallback(useErrorHandler(async () => {
    if (!requestList[selectedRequest].url || !requestList[selectedRequest].method) {
      throw new Error('Missing URL or HTTP method');
    }

    let body: RequestBody = null;
    const headers: HttpHeaders = {};

    for (const header of headersState) {
      if (header.isActive) {
        headers[header.key] = header.value;
      }
    }

    if (requestEditor !== undefined) {
      body = {
        type: RequestBodyType.TEXT,
        mimeType: 'text/plain'
      };
      headers['Content-Type'] = 'text/plain';
    }

    const request: RufusRequest = {
      ...requestList[selectedRequest],
      headers: headers, // TODO: set the headers of the request
      body: body,
      draft: true
    };

    await eventService.saveRequest(request, requestEditor?.getValue());

    // Send the request and pass the response to the onResponse callback
    await onResponse(await httpService.sendRequest(request));
  }), [requestList, selectedRequest, requestEditor, onResponse]);

  const saveRequest = React.useCallback(useErrorHandler(async () => {
    let request = requestList[selectedRequest];
    if (request == null) {
      return;
    }

    // save request draft with the current editor content
    console.info('Saving request:', request);
    await eventService.saveRequest(request, requestEditor?.getValue());

    // override existing request with the saved draft
    request = await eventService.saveChanges(request);
    console.info('Request saved:', request);
    dispatch(updateRequest({ index: selectedRequest, request }));
  }), [requestList, selectedRequest, requestEditor]);

  return (
    <div className={cn('flex mb-[24px]')}>
      <HttpMethodSelect selectedHttpMethod={selectedHttpMethod}
                        onHttpMethodChange={handleHttpMethodChange} />
      <UrlInput url={url} onUrlChange={handleUrlChange} />
      <SendButton onClick={sendRequest} />
      <SaveButton change={requestList[selectedRequest]?.draft} onClick={saveRequest} />
    </div>
  );
}

import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/state/store';
import { editor } from 'monaco-editor';
import { RequestMethod } from 'shim/requestMethod';
import { Request } from 'shim/request';
import { updateRequest } from '@/state/requestsSlice';
import { useErrorHandler } from '@/components/ui/use-toast';
import { HttpService } from '@/services/http/http-service';
import { HttpMethodSelect } from './mainTopBar/HttpMethodSelect';
import { UrlInput } from './mainTopBar/UrlInput';
import { SendButton } from './mainTopBar/SendButton';
import { SaveButton } from './mainTopBar/SaveButton';
import { cn } from '@/lib/utils';
import {HttpHeaders, RequestBody} from "shim/http";

export type RequestProps = {
  onResponse: (response: Response) => Promise<void>;
}

const httpService = HttpService.instance;

export function MainTopBar({ onResponse }: RequestProps) {
  const dispatch = useDispatch();
  const [url, setUrl] = React.useState('');
  const [selectedHttpMethod, setSelectedHttpMethod] = React.useState<RequestMethod>(RequestMethod.get);
  const requestEditor = useSelector<RootState>(state => state.view.requestEditor) as editor.ICodeEditor | undefined;
  const selectedRequest = useSelector<RootState, number>(state => state.requests.selectedRequest);
  const requestList = useSelector<RootState, Request[]>(state => state.requests.requests);

  React.useEffect(() => {
    if (selectedRequest < requestList.length) {
      setSelectedHttpMethod(requestList[selectedRequest].method);
      setUrl(requestList[selectedRequest].url);
    }
  }, [selectedRequest]);

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    setUrl(newUrl);
    dispatch(updateRequest({ index: selectedRequest, request: { ...requestList[selectedRequest], url: newUrl } }));
  };

  const handleHttpMethodChange = (method: RequestMethod) => {
    setSelectedHttpMethod(method);
    dispatch(updateRequest({ index: selectedRequest, request: { ...requestList[selectedRequest], method } }));
  };


const sendRequest = React.useCallback(useErrorHandler(async () => {
  if (! requestList[selectedRequest].url || ! requestList[selectedRequest].method) {
    throw new Error('Missing URL or HTTP method');
  }
  let body: RequestBody = null;
  const headers: HttpHeaders = {};
  if (requestEditor !== undefined) {
    body = {
      type: 'text',
      text: requestEditor.getValue(),
      mimeType: 'text/plain'
    };
    headers['Content-Type'] = 'text/plain';
  }

  const request: Request = {
    ...requestList[selectedRequest],
    headers: headers, // TODO: set the headers of the request
    body: body,
    dirPath: '???' // TODO: set the directory of the request. If it's unsaved, it has to be some temporary directory
  };

  // Send the request and pass the response to the onResponse callback
  const response = await httpService.sendRequest(request); // TODO fix it
  onResponse(response as unknown as Response);
}), [requestList, selectedRequest, requestEditor, onResponse]);

  return (
    <div className={cn('flex mb-[24px]')}>
      <HttpMethodSelect selectedHttpMethod={selectedHttpMethod} onHttpMethodChange={handleHttpMethodChange} />
      <UrlInput url={url} onUrlChange={handleUrlChange} />
      <SendButton onClick={sendRequest} />
      <SaveButton change={requestList[selectedRequest].changed}/>
    </div>
  );
}

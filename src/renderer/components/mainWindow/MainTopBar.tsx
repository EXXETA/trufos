import { useCallback, useEffect, useState } from 'react';
import { RequestMethod } from 'shim/objects/request-method';
import { useErrorHandler } from '@/components/ui/use-toast';
import { HttpService } from '@/services/http/http-service';
import { HttpMethodSelect } from './mainTopBar/HttpMethodSelect';
import { UrlInput } from './mainTopBar/UrlInput';
import { SendButton } from './mainTopBar/SendButton';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { useResponseActions } from '@/state/responseStore';
import { ArrowRight, Loader2, SaveIcon, EraserIcon } from 'lucide-react';
import { showError } from '@/error/errorHandler';
import { editor } from 'monaco-editor';
import { saveModelContent } from '@/lib/monaco/models';
import { TrufosURL } from 'shim/objects/url';
import { IconButton } from '@/components/ui/icon-button';

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

export function MainTopBar() {
  const [isLoading, setIsLoading] = useState(false);

  const { updateRequest, discardRequest } = useCollectionActions();
  const { addResponse } = useResponseActions();
  const request = useCollectionStore(selectRequest)!;
  const { url, method } = request;

  const handleUrlChange = (url: TrufosURL) => updateRequest({ url });
  const handleHttpMethodChange = (method: RequestMethod) => updateRequest({ method });

  const sendRequest = useCallback(
    useErrorHandler(async () => {
      try {
        setIsLoading(true);
        await Promise.all(editor.getModels().map(saveModelContent));

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
      await Promise.all(editor.getModels().map(saveModelContent));

      updateRequest(await eventService.saveChanges(request), true);
    }),
    [request]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
      if (isSaveShortcut && request?.draft) {
        event.preventDefault();
        saveRequest();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveRequest]);

  return (
    <div className="mb-6 flex items-center gap-6">
      <div className="relative flex w-full">
        <HttpMethodSelect selectedHttpMethod={method} onHttpMethodChange={handleHttpMethodChange} />
        <UrlInput url={url} onChange={handleUrlChange} />
      </div>

      <IconButton disabled={!request?.draft} onClick={discardRequest}>
        <EraserIcon />
      </IconButton>

      <IconButton disabled={!request?.draft} onClick={saveRequest}>
        <SaveIcon />
      </IconButton>

      <SendButton onClick={sendRequest} disabled={isLoading}>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight />}
      </SendButton>
    </div>
  );
}

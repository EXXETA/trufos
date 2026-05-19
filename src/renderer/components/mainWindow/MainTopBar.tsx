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
import { ArrowRight, Loader2, SaveIcon } from 'lucide-react';
import { showError } from '@/error/errorHandler';
import { editor } from 'monaco-editor';
import { saveModelContent } from '@/lib/monaco/models';
import { TrufosURL } from 'shim/objects/url';
import { Button } from '@/components/ui/button';

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

export function MainTopBar() {
  const [isLoading, setIsLoading] = useState(false);

  const { updateRequest } = useCollectionActions();
  const { addResponse } = useResponseActions();
  const request = useCollectionStore(selectRequest)!;
  const currentScriptType = useCollectionStore((state) => state.currentScriptType);
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
    [request, currentScriptType, addResponse]
  );

  const saveRequest = useCallback(
    useErrorHandler(async () => {
      if (request == null) return;

      // save request draft with the current editor content
      console.info('Saving request:', request);
      await Promise.all(editor.getModels().map(saveModelContent));

      // override existing request with the saved draft
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

      <Button
        className={`flex h-6 w-6 p-0 ${request?.draft ? 'text-accent-primary' : 'text-(--disabled)'}`}
        variant="ghost"
        disabled={!request?.draft}
        onClick={saveRequest}
      >
        <SaveIcon />
      </Button>

      <SendButton onClick={sendRequest} disabled={isLoading}>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight />}
      </SendButton>
    </div>
  );
}

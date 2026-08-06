import { useCallback } from 'react';
import { RequestMethod } from 'shim/objects/request-method';
import { useErrorHandler } from '@/components/ui/use-toast';
import { HttpMethodSelect } from './mainTopBar/HttpMethodSelect';
import { UrlInput } from './mainTopBar/UrlInput';
import { SendButton } from './mainTopBar/SendButton';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { ArrowRight, Loader2, SaveIcon, EraserIcon } from 'lucide-react';
import { editor } from 'monaco-editor';
import { saveModelContent } from '@/lib/monaco/models';
import { TrufosURL } from 'shim/objects/url';
import { IconButton } from '@/components/ui/icon-button';
import { useHotkeys } from '@/hooks/hotKeys/useHotkey';
import { useSendRequest } from '@/hooks/request/useRequestActions';

const eventService = RendererEventService.instance;

export function MainTopBar() {
  const { updateRequest, discardChanges } = useCollectionActions();
  const request = useCollectionStore(selectRequest)!;
  const { url, method } = request;
  const { sendRequest, isSending } = useSendRequest();

  const handleUrlChange = (url: TrufosURL) => updateRequest({ url });
  const handleHttpMethodChange = (method: RequestMethod) => updateRequest({ method });

  const saveRequest = useCallback(
    useErrorHandler(async () => {
      if (request == null) return;

      console.info('Saving request:', request);
      await Promise.all(editor.getModels().map(saveModelContent));

      updateRequest(await eventService.saveChanges(request), true);
    }),
    [request]
  );

  useHotkeys(
    [
      { keys: 'mod+s', handler: saveRequest },
      { keys: 'mod+enter', handler: sendRequest },
    ],
    { skipFormElements: false }
  );

  return (
    <div className="mb-6 flex items-center gap-6">
      <div className="relative flex w-full">
        <HttpMethodSelect selectedHttpMethod={method} onHttpMethodChange={handleHttpMethodChange} />
        <UrlInput url={url} onChange={handleUrlChange} />
      </div>

      <IconButton disabled={!request?.draft} onClick={discardChanges}>
        <EraserIcon />
      </IconButton>

      <IconButton disabled={!request?.draft} onClick={saveRequest}>
        <SaveIcon />
      </IconButton>

      <SendButton onClick={sendRequest} disabled={isSending}>
        {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight />}
      </SendButton>
    </div>
  );
}

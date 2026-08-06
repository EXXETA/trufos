import { RequestMethod } from 'shim/objects/request-method';
import { HttpMethodSelect } from './mainTopBar/HttpMethodSelect';
import { UrlInput } from './mainTopBar/UrlInput';
import { SendButton } from './mainTopBar/SendButton';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { ArrowRight, Loader2, SaveIcon, EraserIcon } from 'lucide-react';
import { TrufosURL } from 'shim/objects/url';
import { IconButton } from '@/components/ui/icon-button';
import { useHotkeys } from '@/hooks/hotKeys/useHotkey';
import { HOTKEYS } from '@/hooks/hotKeys/hotkeys';
import { useSendRequest, useSaveRequest } from '@/hooks/request/useRequestActions';

export function MainTopBar() {
  const { updateRequest, discardChanges } = useCollectionActions();
  const request = useCollectionStore(selectRequest)!;
  const { url, method } = request;
  const { sendRequest, isSending } = useSendRequest();
  const { saveRequest } = useSaveRequest();

  const handleUrlChange = (url: TrufosURL) => updateRequest({ url });
  const handleHttpMethodChange = (method: RequestMethod) => updateRequest({ method });

  useHotkeys(
    [
      { keys: HOTKEYS.saveRequest, handler: saveRequest },
      { keys: HOTKEYS.sendRequest, handler: sendRequest },
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

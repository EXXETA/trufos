import { useMemo } from 'react';
import { Divider } from '@/components/shared/Divider';
import { isFormattableLanguage, mimeTypeToLanguage } from '@/lib/monaco/language';
import { useResponseStore, selectResponse } from '@/state/responseStore';
import { useCollectionStore, selectRequest } from '@/state/collectionStore';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { getMimeType, RESPONSE_BODY_SIZE_LIMIT } from './PrettyRenderer';
import { ImagePrettyRenderer } from './ImagePrettyRenderer';
import { TextualPrettyRenderer } from './TextualPrettyRenderer';
import { DefaultRenderer } from './DefaultRenderer';
import { useStateDerived } from '@/util/react-util';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { RendererEventService } from '@/services/event/renderer-event-service';

enum OutputType {
  RAW = 'Raw',
  PRETTY = 'Pretty',
}

function canBePrettified(mimeType?: string) {
  if (mimeType == null) return false;
  return isFormattableLanguage(mimeTypeToLanguage(mimeType)) || mimeType.startsWith('image/');
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export const BodyTab = () => {
  const requestId = useCollectionStore((state) => selectRequest(state)?.id);
  const response = useResponseStore((state) => selectResponse(state, requestId));
  const [outputType, setOutputType] = useStateDerived(response, (response) =>
    canBePrettified(getMimeType(response)) ? OutputType.PRETTY : OutputType.RAW
  );
  const mimeType = useMemo(() => getMimeType(response), [response]);
  const [loadFull, setLoadFull] = useStateDerived(response, () => false);

  const bodySize = response?.metaInfo.size.bodySizeInBytes ?? 0;
  const isTooLarge = bodySize > RESPONSE_BODY_SIZE_LIMIT;
  const maxBytes = isTooLarge && !loadFull ? RESPONSE_BODY_SIZE_LIMIT : undefined;
  const showLoadMoreBanner = isTooLarge && !loadFull;

  const outputTypes = useMemo(() => {
    const types: [OutputType, string][] = [[OutputType.RAW, 'Raw']];
    if (canBePrettified(mimeType)) types.push([OutputType.PRETTY, 'Pretty']);
    return types;
  }, [mimeType]);

  const renderContent = () => {
    if (!response) return null;
    if (outputType === OutputType.PRETTY) {
      if (mimeType?.startsWith('image/')) {
        return <ImagePrettyRenderer response={response} />;
      } else {
        return <TextualPrettyRenderer response={response} maxBytes={maxBytes} />;
      }
    } else {
      return <DefaultRenderer response={response} maxBytes={maxBytes} />;
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pt-2">
      <div className="space-y-2 px-4">
        <div className="flex justify-between px-2">
          <SimpleSelect<OutputType>
            value={outputType}
            onValueChange={setOutputType}
            items={outputTypes}
          />
          <IconButton
            disabled={!response?.id}
            onClick={() => RendererEventService.instance.downloadResponse(response!.id)}
            title="Save response body"
          >
            <Download className="h-4 w-4" />
          </IconButton>
        </div>
        <Divider />
      </div>
      <div className="relative flex min-h-0 flex-1 px-4">{renderContent()}</div>
      {showLoadMoreBanner && (
        <div className="text-muted-foreground flex items-center justify-between px-6 pb-3 text-sm">
          <span>
            Showing first {formatBytes(RESPONSE_BODY_SIZE_LIMIT)} of {formatBytes(bodySize)}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setLoadFull(true)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
};

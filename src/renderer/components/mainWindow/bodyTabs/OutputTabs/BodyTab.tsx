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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

enum OutputType {
  RAW = 'Raw',
  PRETTY = 'Pretty',
}

/**
 * Determine if the mime type can be prettified.
 * @param mimeType The mime type to check.
 * @returns True if the mime type can be prettified, false otherwise.
 */
function canBePrettified(mimeType?: string) {
  if (mimeType == null) return false;
  return isFormattableLanguage(mimeTypeToLanguage(mimeType)) || mimeType.startsWith('image/');
}

function formatBytes(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export const BodyTab = () => {
  const requestId = useCollectionStore((state) => selectRequest(state)?.id);
  const response = useResponseStore((state) => selectResponse(state, requestId));
  const [outputType, setOutputType] = useStateDerived(response, (response) =>
    canBePrettified(getMimeType(response)) ? OutputType.PRETTY : OutputType.RAW
  );
  const mimeType = useMemo(() => getMimeType(response), [response]);
  const [forceLoad, setForceLoad] = useStateDerived(response, () => false);
  const [dialogDismissed, setDialogDismissed] = useStateDerived(response, () => false);

  const bodySize = response?.metaInfo.size.bodySizeInBytes ?? 0;
  const isTooLarge = !forceLoad && bodySize > RESPONSE_BODY_SIZE_LIMIT;
  const showDialog = isTooLarge && !dialogDismissed;

  const outputTypes = useMemo(() => {
    const types: [OutputType, string][] = [[OutputType.RAW, 'Raw']];
    if (canBePrettified(mimeType)) types.push([OutputType.PRETTY, 'Pretty']);
    return types;
  }, [mimeType]);

  const renderContent = () => {
    if (isTooLarge && dialogDismissed) {
      return (
        <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3">
          <p className="text-sm">Response body ({formatBytes(bodySize)}) was not loaded.</p>
          <Button variant="secondary" size="sm" onClick={() => setForceLoad(true)}>
            Load anyway
          </Button>
        </div>
      );
    }

    if (outputType === OutputType.PRETTY) {
      if (mimeType?.startsWith('image/')) {
        return <ImagePrettyRenderer response={response} />;
      } else {
        return <TextualPrettyRenderer response={response} skip={isTooLarge} />;
      }
    } else {
      return <DefaultRenderer response={response} skip={isTooLarge} />;
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pt-2">
      <Dialog open={showDialog} onOpenChange={(open) => !open && setDialogDismissed(true)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Large Response Body</DialogTitle>
            <DialogDescription>
              The response body is <strong>{formatBytes(bodySize)}</strong>. Loading it into the
              editor may cause performance issues or freezing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDismissed(true)}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setDialogDismissed(true);
                setForceLoad(true);
              }}
            >
              Load anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2 px-4">
        <div className="flex justify-between px-2">
          <SimpleSelect<OutputType>
            value={outputType}
            onValueChange={setOutputType}
            items={outputTypes}
          />
        </div>
        <Divider />
      </div>
      <div className="relative flex min-h-0 flex-1 px-4">{renderContent()}</div>
    </div>
  );
};

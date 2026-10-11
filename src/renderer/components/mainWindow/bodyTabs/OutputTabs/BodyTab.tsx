import { useMemo } from 'react';
import { editor } from 'monaco-editor';
import { Divider } from '@/components/shared/Divider';
import { isFormattableLanguage, mimeTypeToLanguage } from '@/lib/monaco/language';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { BODY_SIZE_LIMIT, getMimeTypeFromHeaders } from '@/lib/body';
import { ImagePrettyRenderer } from './ImagePrettyRenderer';
import { TextRenderer } from './TextRenderer';
import { useStateDerived } from '@/util/react-util';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { showError } from '@/error/errorHandler';
import { getSizeText } from '@/util/format-util';
import { HttpHeaders } from 'shim/headers';
import { StoredBody } from 'shim/objects/response';

enum OutputType {
  RAW = 'Raw',
  PRETTY = 'Pretty',
}

function canBePrettified(mimeType?: string) {
  if (mimeType == null) return false;
  return isFormattableLanguage(mimeTypeToLanguage(mimeType)) || mimeType.startsWith('image/');
}

export interface BodyTabProps {
  /**
   * The body to show, or `undefined` if there is none. Its identity must be stable, as the output
   * type resets when it changes.
   */
  body?: StoredBody;
  /** The headers sent with the body, used to detect its content type. */
  headers: HttpHeaders;
  /** The model textual bodies are shown in. */
  model: editor.ITextModel;
}

/**
 * Shows a request or response body stored in the main process. It is shown formatted if possible,
 * and large bodies are cut off until the user asks for all of it.
 */
export const BodyTab = ({ body, headers, model }: BodyTabProps) => {
  const mimeType = useMemo(() => getMimeTypeFromHeaders(headers), [headers]);
  const [outputType, setOutputType] = useStateDerived(body, () =>
    canBePrettified(mimeType) ? OutputType.PRETTY : OutputType.RAW
  );
  const [loadFull, setLoadFull] = useStateDerived(body, () => false);

  const bodySize = body?.size ?? 0;
  const isTooLarge = bodySize > BODY_SIZE_LIMIT;
  const maxBytes = isTooLarge && !loadFull ? BODY_SIZE_LIMIT : undefined;
  const showLoadMoreBanner = isTooLarge && !loadFull;

  const outputTypes = useMemo(() => {
    const types: [OutputType, string][] = [[OutputType.RAW, 'Raw']];
    if (canBePrettified(mimeType)) types.push([OutputType.PRETTY, 'Pretty']);
    return types;
  }, [mimeType]);

  const isPretty = outputType === OutputType.PRETTY;
  const renderContent = () => {
    if (isPretty && mimeType?.startsWith('image/')) {
      return <ImagePrettyRenderer body={body} mimeType={mimeType} />;
    }
    return (
      <TextRenderer
        body={body}
        mimeType={mimeType}
        model={model}
        maxBytes={maxBytes}
        // a partially loaded body is usually invalid, so it is shown as it is
        format={isPretty && maxBytes == null}
      />
    );
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
            disabled={body == null}
            onClick={() =>
              body != null &&
              RendererEventService.instance
                .downloadBody(body.id)
                .catch((error) => showError('Could not save the body', error))
            }
            title="Save body"
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
            Showing first {getSizeText(BODY_SIZE_LIMIT)} of {getSizeText(bodySize)}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setLoadFull(true)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
};

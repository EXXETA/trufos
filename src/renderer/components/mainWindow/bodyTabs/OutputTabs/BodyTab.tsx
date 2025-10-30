import { useState, useMemo } from 'react';
import { Divider } from '@/components/shared/Divider';
import { isFormattableLanguage, mimeTypeToLanguage } from '@/lib/monaco/language';
import { useResponseStore, selectResponse, useResponseActions } from '@/state/responseStore';
import { useCollectionStore, selectRequest } from '@/state/collectionStore';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { getMimeType } from './PrettyRenderer';
import { ImagePrettyRenderer } from './ImagePrettyRenderer';
import { TextualPrettyRenderer } from './TextualPrettyRenderer';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { RESPONSE_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { DefaultRenderer } from './DefaultRenderer';
import { useStateDerived } from '@/util/react-util';

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

export const BodyTab = () => {
  const requestId = useCollectionStore((state) => selectRequest(state)?.id);
  const response = useResponseStore((state) => selectResponse(state, requestId));
  const [outputType, setOutputType] = useStateDerived(response, (response) =>
    canBePrettified(getMimeType(response)) ? OutputType.PRETTY : OutputType.RAW
  );
  const mimeType = useMemo(() => getMimeType(response), [response]);

  const outputTypes = useMemo(() => {
    const types: [OutputType, string][] = [[OutputType.RAW, 'Raw']];
    if (canBePrettified(mimeType)) types.push([OutputType.PRETTY, 'Pretty']);
    return types;
  }, [mimeType]);

  const renderContent = () => {
    if (outputType === OutputType.PRETTY) {
      if (mimeType.startsWith('image/')) {
        return <ImagePrettyRenderer response={response} />;
      } else {
        return <TextualPrettyRenderer response={response} />;
      }
    } else {
      return <DefaultRenderer response={response} />;
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 pt-2">
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
      {renderContent()}
    </div>
  );
};

import { useCallback, useState } from 'react';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { RequestBodyType } from 'shim/objects/request';
import { Divider } from '@/components/shared/Divider';
import { isFormattableLanguage, Language } from '@/lib/monaco/language';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import BodyTabFileInput from './BodyTabFileInput';
import BodyTabTextInput from './BodyTabTextInput';
import { Button } from '@/components/ui/button';
import { WandSparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export const BodyTab = () => {
  const { setRequestBody, formatRequestEditorText } = useCollectionActions();

  const requestBody = useCollectionStore((state) => selectRequest(state).body);
  const [language, setLanguage] = useState(Language.JSON);

  const changeBodyType = useCallback(
    (type: RequestBodyType) => {
      switch (type) {
        case RequestBodyType.TEXT:
          setRequestBody({ type, mimeType: 'text/plain' });
          break;
        case RequestBodyType.FILE:
          setRequestBody({ type });
          break;
      }
    },
    [setRequestBody]
  );

  const canFormatRequestBody = isFormattableLanguage(language);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="pt-2 px-4 space-y-2">
        <div className="flex justify-between px-2">
          <div className="flex gap-2 px-2 items-center">
            <SimpleSelect<RequestBodyType>
              value={requestBody?.type ?? RequestBodyType.TEXT}
              onValueChange={changeBodyType}
              items={[
                [RequestBodyType.TEXT, 'Text'],
                [RequestBodyType.FILE, 'File'],
              ]}
            />
            {requestBody.type === RequestBodyType.TEXT && (
              <SimpleSelect<Language>
                value={language}
                onValueChange={setLanguage}
                items={[
                  [Language.JSON, 'JSON'],
                  [Language.XML, 'XML'],
                  [Language.TEXT, 'Plain'],
                ]}
              />
            )}
          </div>
          {requestBody?.type === RequestBodyType.TEXT && (
            <Button
              className={cn('gap-2 h-6', { 'opacity-50': !canFormatRequestBody })}
              size="sm"
              variant="ghost"
              onClick={formatRequestEditorText}
              disabled={!canFormatRequestBody}
            >
              <WandSparkles size={16} />
              Format
            </Button>
          )}
        </div>
        <Divider />
      </div>

      {requestBody?.type === RequestBodyType.FILE ? (
        <BodyTabFileInput className="px-4 pb-2" />
      ) : (
        <BodyTabTextInput className="pr-4" language={language} />
      )}
    </div>
  );
};

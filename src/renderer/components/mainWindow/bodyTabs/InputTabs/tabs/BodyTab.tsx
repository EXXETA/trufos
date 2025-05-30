import { useCallback, useState } from 'react';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { RequestBodyType } from 'shim/objects/request';
import { Divider } from '@/components/shared/Divider';
import { Language } from '@/lib/monaco/language';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import BodyTabFileInput from './BodyTabFileInput';
import BodyTabTextInput from './BodyTabTextInput';

export const BodyTab = () => {
  const { setRequestBody } = useCollectionActions();

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

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="pt-4 px-4 space-y-2">
        <div className="flex gap-2 px-2">
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

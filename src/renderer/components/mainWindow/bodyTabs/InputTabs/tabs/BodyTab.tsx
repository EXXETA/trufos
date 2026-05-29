import { useCallback, useRef } from 'react';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { RequestBodyType } from 'shim/objects/request';
import { Divider } from '@/components/shared/Divider';
import {
  isFormattableLanguage,
  Language,
  languageToMimeType,
  mimeTypeToLanguage,
} from '@/lib/monaco/language';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import BodyTabFileInput from './BodyTabFileInput';
import BodyTabTextInput from './BodyTabTextInput';
import { FormDataTab } from './FormDataTab';
import { Button } from '@/components/ui/button';
import { WandSparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { editor } from 'monaco-editor';

export const BodyTab = () => {
  const { setRequestBody, setRequestBodyMimeType } = useCollectionActions();
  const editorRef = useRef<editor.ICodeEditor | undefined>(undefined);

  const requestBody = useCollectionStore((state) => selectRequest(state)!.body);
  const mimeType = 'mimeType' in requestBody ? requestBody.mimeType : undefined;
  const language = mimeTypeToLanguage(mimeType!);
  const canFormatRequestBody = isFormattableLanguage(language);

  const changeBodyType = useCallback(
    (type: RequestBodyType) => {
      switch (type) {
        case RequestBodyType.TEXT:
          setRequestBody({ type, mimeType: 'text/plain' });
          break;
        case RequestBodyType.FILE:
          setRequestBody({ type });
          break;
        case RequestBodyType.FORM_DATA:
          setRequestBody({ type, fields: [] });
          break;
      }
    },
    [setRequestBody]
  );

  const formatRequestEditorText = useCallback(async () => {
    await editorRef.current?.getAction('editor.action.formatDocument')?.run();
  }, []);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="space-y-2 px-4 pt-2">
        <div className="flex justify-between px-2">
          <div className="flex items-center gap-2 px-2">
            <SimpleSelect<RequestBodyType>
              value={requestBody?.type ?? RequestBodyType.TEXT}
              onValueChange={changeBodyType}
              items={[
                [RequestBodyType.TEXT, 'Text'],
                [RequestBodyType.FILE, 'File'],
                [RequestBodyType.FORM_DATA, 'Form Data'],
              ]}
            />
            {requestBody.type === RequestBodyType.TEXT && (
              <SimpleSelect<Language>
                value={language}
                onValueChange={(language) => setRequestBodyMimeType(languageToMimeType(language))}
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
              className={cn('h-6 gap-2', { 'opacity-50': !canFormatRequestBody })}
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

      {requestBody.type === RequestBodyType.FORM_DATA ? (
        <FormDataTab />
      ) : requestBody.type === RequestBodyType.FILE ? (
        <BodyTabFileInput className="px-4 pb-2" />
      ) : (
        <BodyTabTextInput
          className="pr-4"
          language={language}
          onMount={(editorInstance) => {
            editorRef.current = editorInstance;
          }}
        />
      )}
    </div>
  );
};

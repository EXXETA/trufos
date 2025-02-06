import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RequestBodyType } from 'shim/objects/request';
import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Editor } from '@monaco-editor/react';
import { Input } from '@/components/ui/input';
import { useCallback, useState } from 'react';
import { editor } from 'monaco-editor';
import { Divider } from '@/components/shared/Divider';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { Language } from '@/lib/monaco/language';
import { HeaderTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/HeaderTab';

interface InputTabsProps {
  className: string;
}

export function InputTabs(props: InputTabsProps) {
  const { className } = props;
  const { setRequestBody, setRequestEditor, setDraftFlag } = useCollectionActions();

  const requestBody = useCollectionStore((state) => selectRequest(state).body);
  const headers = useCollectionStore((state) => selectRequest(state).headers);
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

  const setRequestBodyFile = useCallback(
    (file?: File) => {
      if (file == null) return;
      setRequestBody({
        type: RequestBodyType.FILE,
        filePath: file.path,
        mimeType: file.type === '' ? undefined : file.type,
      });
    },
    [setRequestBody]
  );

  const onEditorMount = useCallback(
    (editor: editor.ICodeEditor) => {
      setRequestEditor(editor);
      editor.onDidChangeModelContent((e) => {
        if (e.isFlush) return;
        setDraftFlag();
      });
    },
    [setRequestEditor, setDraftFlag]
  );

  const renderEditor = useCallback(() => {
    return (
      <Editor
        theme="vs-dark" /* TODO: apply theme from settings */
        options={REQUEST_EDITOR_OPTIONS}
        language={language}
        onMount={onEditorMount}
      />
    );
  }, [onEditorMount, language]);

  const renderFileInput = useCallback(() => {
    return (
      <Input
        onChange={(v) => setRequestBodyFile(v.target.files[0])}
        placeholder="Select a file"
        type="file"
      />
    );
  }, [setRequestBodyFile]);

  const renderSelectLanguage = useCallback(() => {
    // if (requestBody?.type !== RequestBodyType.TEXT) return null;
    return (
      <SimpleSelect<Language>
        value={language}
        onValueChange={setLanguage}
        items={[
          [Language.JSON, 'JSON'],
          [Language.XML, 'XML'],
          [Language.TEXT, 'Plain'],
        ]}
      />
    );
  }, [language, setLanguage, requestBody?.type]);

  const getActiveRowCount = useCallback(
    () => headers.filter((header) => header.isActive).length,
    [headers]
  );

  return (
    <Tabs className={className} defaultValue="body">
      <TabsList>
        <TabsTrigger value="body">Body</TabsTrigger>
        {/*<TabsTrigger value="queryParams">Query</TabsTrigger>*/}
        <TabsTrigger value="headers">
          {getActiveRowCount() === 0 ? 'Headers' : `Headers (${getActiveRowCount()})`}
        </TabsTrigger>
        {/*<TabsTrigger value="authorization">Auth</TabsTrigger>*/}
      </TabsList>

      <TabsContent value="body">
        <div className={'h-full relative'}>
          <div className={'absolute top-[16px] right-[16px] left-[16px] z-10'}>
            <div className={'flex justify-end'}>
              {renderSelectLanguage()}
              <SimpleSelect
                value={requestBody?.type ?? RequestBodyType.TEXT}
                onValueChange={changeBodyType}
                items={[
                  [RequestBodyType.TEXT, 'Text'],
                  [RequestBodyType.FILE, 'File'],
                ]}
              />
            </div>

            <Divider className={'mt-2'} />
          </div>

          <div className="absolute top-[68px] left-0 bottom-0 right-0">
            {requestBody?.type === RequestBodyType.FILE ? renderFileInput() : renderEditor()}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="queryParams">Change your queryParams here.</TabsContent>

      <TabsContent value="headers">
        <HeaderTab />
      </TabsContent>

      <TabsContent value="authorization">Change your authorization here.</TabsContent>
    </Tabs>
  );
}

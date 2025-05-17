import { useCallback, useState } from 'react';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { RequestBodyType } from 'shim/objects/request';
import { Divider } from '@/components/shared/Divider';
import { Editor } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Input } from '@/components/ui/input';
import { Language } from '@/lib/monaco/language';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';

export const BodyTab = () => {
  const { setRequestBody, setRequestEditor, setDraftFlag } = useCollectionActions();

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
        onMount={(editor) => {
          onEditorMount(editor);
        }}
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

  return (
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
  );
};

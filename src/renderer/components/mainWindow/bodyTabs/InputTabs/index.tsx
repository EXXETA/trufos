import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RequestBodyType } from 'shim/objects/request';
import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Editor } from '@monaco-editor/react';
import { Input } from '@/components/ui/input';
import { useCallback, useState } from 'react';
import { editor } from 'monaco-editor';
import { Divider } from '@/components/shared/Divider';
import { Button } from '@/components/ui/button';
import { AddIcon, CheckedIcon, DeleteIcon } from '@/components/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TrufosHeader } from 'shim/objects/headers';
import { selectRequest, useRequestActions, useRequestStore } from '@/state/requestStore';
import { SimpleSelect } from '@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect';
import { Language } from '@/lib/monaco/language';

interface InputTabsProps {
  className: string;
}

export function InputTabs(props: InputTabsProps) {
  const { className } = props;
  const {
    setRequestBody,
    setRequestEditor,
    setDraftFlag,
    addHeader,
    deleteHeader,
    clearHeaders,
    updateHeader,
  } = useRequestActions();

  const requestBody = useRequestStore((state) => selectRequest(state).body);
  const headers = useRequestStore((state) => selectRequest(state).headers);
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
    if (requestBody?.type !== RequestBodyType.TEXT) return null;
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

  const handleAddHeader = addHeader;

  const handleDeleteHeader = deleteHeader;

  const deleteAllHeaders = clearHeaders;

  const handleUpdateHeader = (index: number, updatedFields: Partial<TrufosHeader>) =>
    updateHeader(index, updatedFields);

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
        <div className={'xl:h-full overflow-auto min-h-[30vh] relative'}>
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
        <div className={'p-4 h-full relative'}>
          <div className={'absolute top-[16px] right-[16px] left-[16px] z-10'}>
            <div className={'flex'}>
              <Button
                className={'hover:bg-transparent gap-1 h-fit'}
                size={'sm'}
                variant={'ghost'}
                onClick={handleAddHeader}
              >
                <AddIcon />
                Add Header
              </Button>
              <Button
                className={'hover:bg-transparent gap-1 h-fit'}
                size={'sm'}
                variant={'ghost'}
                onClick={deleteAllHeaders}
              >
                <DeleteIcon />
                Delete All
              </Button>
            </div>

            <Divider className={'mt-2'} />
          </div>

          <div className="absolute top-[68px] left-[16px] bottom-[16px] right-[16px]">
            <Table className="table-auto w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-auto">Key</TableHead>
                  <TableHead className="w-full">Value</TableHead>
                  <TableHead className="w-16"> {/* Action Column */} </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {headers.map((header, index) => (
                  <TableRow key={index}>
                    {/* Editable key field */}
                    <TableCell className="w-1/3 break-all">
                      <input
                        type="text"
                        value={header.key}
                        onChange={(e) => handleUpdateHeader(index, { key: e.target.value })}
                        className="w-full bg-transparent outline-none"
                        placeholder="Enter header key"
                      />
                    </TableCell>

                    <TableCell className="w-full break-all">
                      <input
                        type="text"
                        value={header.value}
                        onChange={(e) => handleUpdateHeader(index, { value: e.target.value })}
                        className="w-full bg-transparent outline-none"
                        placeholder="Enter header value"
                      />
                    </TableCell>

                    <TableCell className="w-16 text-right">
                      <div className="flex items-center justify-center gap-2">
                        <div className={'relative h-4 z-10 cursor-pointer'}>
                          <input
                            type="checkbox"
                            checked={header.isActive}
                            onChange={(e) =>
                              handleUpdateHeader(index, { isActive: e.target.checked })
                            }
                            className={cn(
                              'form-checkbox h-4 w-4 appearance-none border rounded-[2px] ',
                              header.isActive
                                ? 'border-[rgba(107,194,224,1)] bg-[rgba(25,54,65,1)]'
                                : 'border-[rgba(238,238,238,1)] bg-transparent'
                            )}
                          />

                          {header.isActive && (
                            <div
                              className={
                                'absolute left-0 top-0 h-4 w-4 flex items-center justify-center pointer-events-none rotate-6'
                              }
                            >
                              <CheckedIcon
                                size={16}
                                viewBox={'0 0 16 16'}
                                color={'rgba(107,194,224,1)'}
                              />
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-transparent hover:text-[rgba(107,194,224,1)] active:text-[#12B1E7] h-6 w-6"
                          onClick={() => handleDeleteHeader(index)}
                        >
                          <DeleteIcon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="authorization">Change your authorization here.</TabsContent>
    </Tabs>
  );
}

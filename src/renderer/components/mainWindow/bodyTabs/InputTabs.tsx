import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDispatch, useSelector } from 'react-redux';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RequestBodyType } from 'shim/objects/request';
import { DEFAULT_MONACO_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Editor } from '@monaco-editor/react';
import { Input } from '@/components/ui/input';
import { RootState } from '@/state/store';
import {
  addHeader,
  clearHeaders,
  deleteHeader,
  selectHeaders,
  setDraftFlag,
  setRequestBody,
  setRequestEditor,
  updateHeader,
} from '@/state/requestsSlice';
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
import { RufusHeader } from 'shim/objects/headers';

interface InputTabsProps {
  className: string;
}

export function InputTabs(props: InputTabsProps) {
  const { className } = props;
  const dispatch = useDispatch();
  const requestBody = useSelector(
    ({ requests }: RootState) => requests.requests[requests.selectedRequest]?.body
  );
  const headers = useSelector(selectHeaders);

  const [isOpen, setIsOpen] = useState(false);

  const changeBodyType = useCallback(
    (type: RequestBodyType) => {
      switch (type) {
        case RequestBodyType.TEXT:
          dispatch(setRequestBody({ type, mimeType: 'text/plain' }));
          break;
        case RequestBodyType.FILE:
          dispatch(setRequestBody({ type }));
          break;
      }
    },
    [dispatch]
  );

  const setRequestBodyFile = useCallback(
    (file?: File) => {
      if (file == null) return;
      dispatch(
        setRequestBody({
          type: RequestBodyType.FILE,
          filePath: file.path,
          mimeType: file.type === '' ? undefined : file.type,
        })
      );
    },
    [dispatch]
  );

  const onEditorMount = useCallback(
    (editor: editor.ICodeEditor) => {
      dispatch(setRequestEditor(editor));
      editor.onDidChangeModelContent((e) => {
        if (e.isFlush) return;
        dispatch(setDraftFlag());
      });
    },
    [dispatch]
  );

  const renderEditor = useCallback(() => {
    return (
      <Editor
        theme="vs-dark" /* TODO: apply theme from settings */
        options={DEFAULT_MONACO_OPTIONS}
        onMount={onEditorMount}
      />
    );
  }, [onEditorMount]);

  const renderFileInput = useCallback(() => {
    return (
      <Input
        onChange={(v) => setRequestBodyFile(v.target.files[0])}
        placeholder="Select a file"
        type="file"
      />
    );
  }, [setRequestBodyFile]);

  const handleAddHeader = useCallback(() => {
    dispatch(addHeader());
  }, [dispatch]);

  const handleDeleteHeader = useCallback(
    (index: number) => {
      dispatch(deleteHeader(index));
    },
    [dispatch]
  );

  const deleteAllHeaders = useCallback(() => {
    dispatch(clearHeaders());
  }, [dispatch]);

  const handleUpdateHeader = useCallback(
    (index: number, updatedFields: Partial<RufusHeader>) => {
      dispatch(updateHeader({ index, updatedHeader: updatedFields }));
    },
    [dispatch]
  );

  const getActiveRowCount = useCallback(() => {
    return headers.filter((header) => header.isActive).length;
  }, [headers]);

  return (
    <Tabs className={className} defaultValue="body">
      <TabsList>
        <TabsTrigger className={'tabs-trigger'} value="body">
          Body
        </TabsTrigger>
        <TabsTrigger className={'tabs-trigger'} value="queryParams">
          Query
        </TabsTrigger>
        <TabsTrigger className={'tabs-trigger'} value="headers">
          {getActiveRowCount() === 0 ? 'Headers' : `Headers (${getActiveRowCount()})`}
        </TabsTrigger>
        <TabsTrigger className={'tabs-trigger'} value="authorization">
          Auth
        </TabsTrigger>
      </TabsList>

      <TabsContent value="body">
        <div className={'p-4 h-full relative'}>
          <div className={'absolute top-[16px] right-[16px] left-[16px] z-10'}>
            <div className={'flex justify-end'}>
              <Select
                value={requestBody?.type ?? RequestBodyType.TEXT}
                onValueChange={(bodyType) => changeBodyType(bodyType as RequestBodyType)}
                onOpenChange={(open) => setIsOpen(open)}
                defaultValue={'text'}
              >
                <SelectTrigger className={'w-[fit-content] h-[fit-content] p-0 '} isOpen={isOpen}>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>

                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={RequestBodyType.TEXT}>Text</SelectItem>
                    <SelectItem value={RequestBodyType.FILE}>File</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <Divider className={'mt-2'} />
          </div>

          <div className="absolute top-[68px] left-[16px] bottom-[16px] right-[16px]">
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

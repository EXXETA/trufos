import { useEffect, useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Editor } from '@monaco-editor/react';
import { RESPONSE_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { HttpHeaders } from 'shim/headers';
import { ResponseStatus } from '@/components/mainWindow/responseStatus/ResponseStatus';
import { IpcPushStream } from '@/lib/ipc-stream';
import { selectResponse, useResponseActions, useResponseStore } from '@/state/responseStore';
import { selectRequest, useCollectionStore } from '@/state/collectionStore';

/**
 * Get the mime type from the content type.
 * @param contentType The content type to get the mime type from.
 */
function getMimeType(contentType?: string) {
  if (contentType !== undefined) {
    const index = contentType.indexOf(';');
    return (index === -1 ? contentType : contentType.substring(0, index)).trim();
  }
}

/**
 * Get the content type without any encoding from the headers.
 * @param headers The headers to get the content type from.
 */
function getContentType(headers?: HttpHeaders) {
  const value = headers?.['content-type'];
  if (value !== undefined) {
    return Array.isArray(value) ? value[0] : value;
  }
}

interface OutputTabsProps {
  className: string;
}

export function OutputTabs(props: OutputTabsProps) {
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  const tabsRef = useRef<HTMLDivElement>(null);

  const { className } = props;
  const { setResponseEditor } = useResponseActions();
  const editor = useResponseStore((state) => state.editor);
  const requestId = useCollectionStore((state) => selectRequest(state)?.id);
  const response = useResponseStore((state) => selectResponse(state, requestId));

  const headers = response?.headers;

  const mimeType = getMimeType(getContentType(headers));

  useEffect(() => {
    if (editor == null) {
      return;
    } else if (response?.bodyFilePath == null) {
      editor.setValue('');
    } else {
      editor.setValue('');
      IpcPushStream.open(response.bodyFilePath)
        .then((stream) => IpcPushStream.collect(stream))
        .then((content) => editor.setValue(content));
    }
  }, [response?.bodyFilePath, editor]);

  const updateMaxHeight = () => {
    const windowHeight = window.innerHeight;
    const calculated = windowHeight - 88;

    setMaxHeight(calculated);
  };

  useEffect(() => {
    updateMaxHeight();

    window.addEventListener('resize', updateMaxHeight);

    return () => {
      window.removeEventListener('resize', updateMaxHeight);
    };
  }, []);

  return (
    <Tabs className={className} defaultValue="body" ref={tabsRef}>
      <TabsList className={'flex justify-between items-center'}>
        <div className="flex">
          <TabsTrigger value="body">Response Body</TabsTrigger>
          <TabsTrigger value="header">Headers</TabsTrigger>
        </div>

        <ResponseStatus />
      </TabsList>

      <TabsContent value="body" className={`pt-4`}>
        <Editor
          height={`calc(${maxHeight}px - 108px)`}
          language={mimeType}
          theme="vs-dark" /* TODO: apply theme from settings */
          options={{
            ...RESPONSE_EDITOR_OPTIONS,
          }}
          onMount={(editor) => {
            setResponseEditor(editor);
          }}
        />
      </TabsContent>

      <TabsContent value="header" className={`max-h-[calc(100vh-160px)] p-4`}>
        {!headers ? (
          <div className={'flex items-center justify-center w-full h-full text-center'}>
            <span>Please enter URL address and click Send to get a response</span>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table className={`table-auto w-full`}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-auto">Key</TableHead>
                  <TableHead className="w-full">Value</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {headers &&
                  Object.keys(headers).map((key) => {
                    const value = headers[key];
                    const valueToDisplay =
                      value !== undefined ? (Array.isArray(value) ? value : [value]) : '';
                    return (
                      <TableRow key={key}>
                        <TableCell className="w-1/3">{key}</TableCell>
                        <TableCell>{(valueToDisplay as string[]).join(', ')}</TableCell>{' '}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

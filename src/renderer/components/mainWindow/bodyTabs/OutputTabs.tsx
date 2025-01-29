import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Editor } from '@monaco-editor/react';
import { RESPONSE_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { HttpHeaders } from 'shim/headers';
import { useEffect, useRef } from 'react';
import { ResponseStatus } from '@/components/mainWindow/responseStatus/ResponseStatus';
import { IpcPushStream } from '@/lib/ipc-stream';
import { selectResponse, useResponseActions, useResponseStore } from '@/state/responseStore';
import { selectRequest, useRequestStore } from '@/state/requestStore';

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
  const { className } = props;
  const { setResponseEditor } = useResponseActions();
  const editor = useResponseStore((state) => state.editor);
  const requestId = useRequestStore((state) => selectRequest(state)?.id);
  const response = useResponseStore((state) => selectResponse(state, requestId));
  const tabsRef = useRef(null);

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

  if (response == null) {
    return null;
  }

  const { headers } = response;
  const mimeType = getMimeType(getContentType(headers));
  console.debug('Using syntax highlighting for mime type', mimeType);

  return (
    <Tabs className={className} defaultValue="body" ref={tabsRef}>
      <TabsList className="flex flex-row items-center">
        <TabsTrigger value="body">Response Body</TabsTrigger>
        <TabsTrigger value="header">Headers</TabsTrigger>
        <ResponseStatus />
      </TabsList>

      <TabsContent value="body">
        <div className={'xl:h-full min-h-[50vh]'}>
          <Editor
            language={mimeType}
            theme="vs-dark" /* TODO: apply theme from settings */
            options={RESPONSE_EDITOR_OPTIONS}
            onMount={setResponseEditor}
          />
        </div>
      </TabsContent>

      <TabsContent value="header" className={`max-h-[${tabsRef.current?.offsetHeight - 88}px] p-4`}>
        {!headers ? (
          <div className={'flex items-center justify-center w-full h-full text-center'}>
            <span>Please enter URL address and click Send to get a response</span>
          </div>
        ) : (
          <Table className="table-auto w-full">
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
                      {/* Full width */}
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        )}
      </TabsContent>
    </Tabs>
  );
}

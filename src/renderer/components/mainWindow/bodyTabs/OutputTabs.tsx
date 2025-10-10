import { useEffect, useState, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RESPONSE_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { HttpHeaders } from 'shim/headers';
import { ResponseStatus } from '@/components/mainWindow/responseStatus/ResponseStatus';
import { IpcPushStream } from '@/lib/ipc-stream';
import { selectResponse, useResponseActions, useResponseStore } from '@/state/responseStore';
import { selectRequest, useCollectionStore } from '@/state/collectionStore';
import { Divider } from '@/components/shared/Divider';
import { Button } from '@/components/ui/button';
import { WandSparkles } from 'lucide-react';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { cn } from '@/lib/utils';
import { isFormattableLanguage } from '@/lib/monaco/language';
import { RESPONSE_MODEL } from '@/lib/monaco/models';

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

export function OutputTabs({ className }: OutputTabsProps) {
  const { setResponseEditor, formatResponseEditorText } = useResponseActions();
  const editor = useResponseStore((state) => state.editor);
  const requestId = useCollectionStore((state) => selectRequest(state)?.id);
  const response = useResponseStore((state) => selectResponse(state, requestId));

  const [editorLanguage, setEditorLanguage] = useState<string | undefined>();

  const mimeType = useMemo(() => {
    const contentType = getContentType(response?.headers);
    return getMimeType(contentType);
  }, [response?.headers]);

  useEffect(() => {
    const updateEditorContent = async () => {
      RESPONSE_MODEL.setValue('');
      if (response?.responseId != null) {
        const stream = await IpcPushStream.open({ type: 'response', id: response.responseId });
        const content = await IpcPushStream.collect(stream);
        RESPONSE_MODEL.setValue(content);
        if (response?.autoFormat) {
          formatResponseEditorText(requestId);
        }
      }
    };

    updateEditorContent();
  }, [response, requestId]);

  useEffect(() => {
    if (!editor) return;

    setEditorLanguage(RESPONSE_MODEL.getLanguageId());
    const disposable = RESPONSE_MODEL.onDidChangeLanguage((e) => {
      setEditorLanguage(e.newLanguage);
    });

    return () => disposable.dispose();
  }, [mimeType]);

  const canFormatResponseBody = useMemo(() => {
    return response?.responseId && isFormattableLanguage(editorLanguage);
  }, [response?.responseId, editorLanguage]);

  const handleFormatResponseBody = useCallback(() => {
    if (requestId && canFormatResponseBody) {
      formatResponseEditorText(requestId);
    }
  }, [requestId, canFormatResponseBody, formatResponseEditorText]);

  return (
    <Tabs className={className} defaultValue="body">
      <TabsList className="flex items-center justify-between">
        <div className="flex">
          <TabsTrigger value="body">Response Body</TabsTrigger>
          <TabsTrigger value="header">Headers</TabsTrigger>
        </div>
        <ResponseStatus />
      </TabsList>

      <TabsContent value="body">
        <div className="flex h-full flex-col gap-4 pt-2">
          <div className="space-y-2 px-4">
            <div className="flex justify-end px-2">
              <Button
                className={cn('h-6 gap-2', { 'opacity-50': !canFormatResponseBody })}
                size="sm"
                variant="ghost"
                onClick={handleFormatResponseBody}
                disabled={!canFormatResponseBody}
              >
                <WandSparkles size={16} />
                Format
              </Button>
            </div>
            <Divider />
          </div>

          <MonacoEditor
            className="absolute h-full"
            language={mimeType}
            options={RESPONSE_EDITOR_OPTIONS}
            onMount={setResponseEditor}
          />
        </div>
      </TabsContent>

      <TabsContent value="header" className="p-4">
        {!response?.headers ? (
          <div className="flex h-full w-full items-center justify-center text-center">
            <span>Please enter URL address and click Send to get a response</span>
          </div>
        ) : (
          <div className="h-0">
            <Table className="w-full table-auto">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-auto">Key</TableHead>
                  <TableHead className="w-full">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(response.headers).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="w-1/3">{key}</TableCell>
                    <TableCell>{Array.isArray(value) ? value.join(', ') : value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

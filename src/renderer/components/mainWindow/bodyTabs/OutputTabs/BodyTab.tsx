import { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Divider } from '@/components/shared/Divider';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { RESPONSE_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { WandSparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isFormattableLanguage } from '@/lib/monaco/language';
import { RESPONSE_MODEL } from '@/lib/monaco/models';
import { IpcPushStream } from '@/lib/ipc-stream';
import { useResponseActions, useResponseStore, selectResponse } from '@/state/responseStore';
import { useCollectionStore, selectRequest } from '@/state/collectionStore';
import { HttpHeaders } from 'shim/headers';

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

export const BodyTab = () => {
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
      if (response?.id != null) {
        const stream = await IpcPushStream.open(response);
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
    return response?.id && isFormattableLanguage(editorLanguage);
  }, [response?.id, editorLanguage]);

  const handleFormatResponseBody = useCallback(() => {
    if (requestId && canFormatResponseBody) {
      formatResponseEditorText(requestId);
    }
  }, [requestId, canFormatResponseBody, formatResponseEditorText]);

  return (
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
  );
};

import { useEffect, useMemo, useRef, useState } from 'react';
import { editor } from 'monaco-editor';
import { Download } from 'lucide-react';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { isFormattableLanguage, mimeTypeToLanguage } from '@/lib/monaco/language';
import { IpcPushStream } from '@/lib/ipc-stream';
import { RESPONSE_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import {
  RESPONSE_BODY_SIZE_LIMIT,
  useResponseMimeType,
} from '@/components/mainWindow/bodyTabs/OutputTabs/PrettyRenderer';
import { getSizeText } from '@/components/mainWindow/responseStatus/ResponseStatusFormatter';
import { IconButton } from '@/components/ui/icon-button';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { showError } from '@/error/errorHandler';
import { HttpHeaders } from 'shim/headers';
import { StoredBody } from 'shim/history';

export interface HistoryBodyViewerProps {
  body: StoredBody;
  /** The headers sent with the body, used to detect its content type. */
  headers: HttpHeaders;
}

/**
 * Shows a request or response body of the request history. The body is streamed from the main
 * process when the viewer is opened, so only the body that is looked at is loaded. Large bodies
 * are cut off like in the response panel; the full body can be downloaded.
 */
export const HistoryBodyViewer = ({ body, headers }: HistoryBodyViewerProps) => {
  const mimeType = useResponseMimeType(headers);
  const isImage = mimeType?.startsWith('image/') === true;
  const isTruncated = body.size > RESPONSE_BODY_SIZE_LIMIT;
  const [content, setContent] = useState<string>();

  useEffect(() => {
    let canceled = false;
    let stream: IpcPushStream | undefined;
    setContent(undefined);
    IpcPushStream.open(
      { type: 'body', id: body.id },
      isImage ? 'base64' : 'utf-8',
      isTruncated ? RESPONSE_BODY_SIZE_LIMIT : undefined
    )
      .then((s) => {
        stream = s;
        return canceled ? undefined : s.readAll();
      })
      .then((data) => {
        if (!canceled && data !== undefined) setContent(data);
      })
      .catch((error) => showError('Could not load the body', error));

    return () => {
      canceled = true;
      stream?.close();
    };
  }, [body.id, isImage, isTruncated]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-secondary text-xs">
          {mimeType ?? 'Unknown content type'} · {getSizeText(body.size)}
          {isTruncated && ` · showing the first ${getSizeText(RESPONSE_BODY_SIZE_LIMIT)}`}
        </span>
        <IconButton
          title="Save body"
          onClick={() =>
            RendererEventService.instance
              .downloadResponse(body.id)
              .catch((error) => showError('Could not save the body', error))
          }
        >
          <Download className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="relative min-h-0 flex-1">
        {isImage ? (
          content != null && (
            <img
              src={`data:${mimeType};base64,${content}`}
              alt="Body"
              className="absolute inset-0 h-full w-full object-contain"
            />
          )
        ) : (
          <TextBody content={content} mimeType={mimeType} format={!isTruncated} />
        )}
      </div>
    </div>
  );
};

interface TextBodyProps {
  content?: string;
  mimeType?: string;
  format: boolean;
}

const TextBody = ({ content, mimeType, format }: TextBodyProps) => {
  const language = (mimeType != null ? mimeTypeToLanguage(mimeType) : undefined) ?? 'plaintext';
  const editorRef = useRef<editor.ICodeEditor>(undefined);

  // a model of its own, disposed with the viewer, so viewing many entries does not leak models
  const model = useMemo(() => editor.createModel('', language), [language]);
  useEffect(() => () => model.dispose(), [model]);

  useEffect(() => {
    model.setValue(content ?? '');
    const instance = editorRef.current;
    if (content == null || instance == null || !format || !isFormattableLanguage(language)) return;
    instance.updateOptions({ readOnly: false });
    void instance
      .getAction('editor.action.formatDocument')
      ?.run()
      .finally(() => instance.updateOptions({ readOnly: true }));
  }, [model, content, format, language]);

  return (
    <MonacoEditor
      className="absolute h-full"
      language={language}
      options={RESPONSE_EDITOR_OPTIONS}
      model={model}
      onMount={(instance) => (editorRef.current = instance)}
    />
  );
};

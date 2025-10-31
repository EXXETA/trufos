import { getToastForError } from '@/components/ui/use-toast';
import { IpcPushStream, IpcPushStreamError, IpcPushStreamErrorType } from '@/lib/ipc-stream';
import { useResponseActions, useResponseStore } from '@/state/responseStore';
import { FC, useEffect, useMemo, useState } from 'react';
import { HttpHeaders } from 'shim/headers';
import { StringBufferEncoding } from 'shim/ipc-stream';
import { TrufosResponse } from 'shim/objects/response';

export interface PrettyRendererProps {
  response: TrufosResponse;
}

export type ResponseRenderer = FC<PrettyRendererProps>;

/**
 * Get the mime type from the content type.
 * @param contentType The content type to get the mime type from.
 */
function getMimeTypeFromContentType(contentType?: string) {
  return contentType?.split(';', 1)[0].trim();
}

/**
 * Get the content type without any encoding from the headers.
 * @param headers The headers to get the content type from.
 */
function getContentTypeFromHeaders(headers?: HttpHeaders) {
  const value = headers?.['content-type'];
  if (value !== undefined) {
    return Array.isArray(value) ? value[0] : value;
  }
}

/**
 * Get the mime type from the response headers.
 * @param response The response to get the mime type from.
 * @returns The mime type or undefined if not found.
 */
export function getMimeType(response: TrufosResponse) {
  return getMimeTypeFromContentType(getContentTypeFromHeaders(response.headers));
}

export const useResponseMimeType = (headers: HttpHeaders) =>
  useMemo(() => getMimeTypeFromContentType(getContentTypeFromHeaders(headers)), [headers]);

export const useResponseData = (
  response: TrufosResponse,
  encoding: StringBufferEncoding,
  onChange: (data: string) => void
) => {
  useEffect(() => {
    let stream: IpcPushStream | undefined;
    IpcPushStream.open(response, encoding)
      .then((s) => (stream = s).readAll())
      .then(onChange)
      .catch((err) => {
        if (!(err instanceof IpcPushStreamError) || err.type !== IpcPushStreamErrorType.Aborted) {
          getToastForError(err);
        }
      });

    // cancel stream on unmount or response change
    return () => stream?.close();
  }, [response, encoding, onChange]);
};

export const useResponseEditor = () => {
  const { setResponseEditor, formatResponseEditorText } = useResponseActions();
  const editor = useResponseStore((state) => state.editor);
  const [editorLanguage, setEditorLanguage] = useState<string | undefined>();

  return { setResponseEditor, formatResponseEditorText, editor, editorLanguage, setEditorLanguage };
};

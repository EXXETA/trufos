import { useResponseActions } from '@/state/responseStore';
import { FC, useMemo, useState } from 'react';
import { HttpHeaders } from 'shim/headers';
import { TrufosResponse } from 'shim/objects/response';

export const RESPONSE_BODY_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB

export interface PrettyRendererProps {
  response: TrufosResponse;
  maxBytes?: number;
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
export function getMimeType(response?: TrufosResponse) {
  return getMimeTypeFromContentType(getContentTypeFromHeaders(response?.headers));
}

export const useResponseMimeType = (headers: HttpHeaders) =>
  useMemo(() => getMimeTypeFromContentType(getContentTypeFromHeaders(headers)), [headers]);

export const useResponseEditor = () => {
  const { setResponseEditor, formatResponseEditorText } = useResponseActions();
  const [editorLanguage, setEditorLanguage] = useState<string | undefined>();

  return { setResponseEditor, formatResponseEditorText, editorLanguage, setEditorLanguage };
};

import { useResponseActions } from '@/state/responseStore';
import { FC, useState } from 'react';
import { getMimeTypeFromHeaders } from '@/lib/body';
import { TrufosResponse } from 'shim/objects/response';

export interface PrettyRendererProps {
  response: TrufosResponse;
  maxBytes?: number;
}

export type ResponseRenderer = FC<PrettyRendererProps>;

/**
 * Get the mime type from the response headers.
 * @param response The response to get the mime type from.
 * @returns The mime type or undefined if not found.
 */
export function getMimeType(response?: TrufosResponse) {
  return getMimeTypeFromHeaders(response?.headers);
}

export const useResponseEditor = () => {
  const { setResponseEditor, formatResponseEditorText } = useResponseActions();
  const [editorLanguage, setEditorLanguage] = useState<string | undefined>();

  return { setResponseEditor, formatResponseEditorText, editorLanguage, setEditorLanguage };
};

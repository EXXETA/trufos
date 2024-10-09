import { HttpHeaders } from 'shim/headers';
import { RequestMethod } from './requestMethod';

export const TEXT_BODY_FILE_NAME = 'request-body.txt';
export const DRAFT_TEXT_BODY_FILE_NAME = '~' + TEXT_BODY_FILE_NAME;
export type RufusRequest = {
  id: string;
  parentId: string;
  type: 'request';
  title: string;
  url: string;
  method: RequestMethod;
  headers: HttpHeaders;
  body: RequestBody | null;
  draft?: boolean;
}

export type RequestBody = TextBody | FileBody;

export enum RequestBodyType {
  TEXT = 'text',
  FILE = 'file'
}

export type TextBody = {
  type: RequestBodyType.TEXT;
  /** The body content as a string. Used for importing from third party collections. Usually, this is only stored on the file system */
  text?: string;
  /** The mime type of the file content, e.g. "application/json". May include an encoding */
  mimeType: string;
}

export type FileBody = {
  type: RequestBodyType.FILE;
  filePath?: string;
  /** The mime type of the file content, e.g. "application/json". May include an encoding */
  mimeType?: string;
}

export function sanitizeTitle(title: string): string {
  return title
  .toLowerCase()
  .replace(/\s/g, '-')
  .replace(/[^a-z0-9-]/g, '');
}

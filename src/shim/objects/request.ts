import { AuthorizationInformation } from './auth';
import { TrufosHeader } from './headers';
import { TrufosQueryParam } from './query-param';
import { RequestMethod } from './request-method';

export const TEXT_BODY_FILE_NAME = 'request-body.txt';
export type TrufosRequest = {
  id: string;
  parentId: string;
  type: 'request';
  title: string;
  url: string;
  method: RequestMethod;
  headers: TrufosHeader[];
  queryParams: TrufosQueryParam[];
  body: RequestBody;
  draft?: boolean;
  auth?: AuthorizationInformation;
  index?: number;
};

export type RequestBody = TextBody | FileBody;

export enum RequestBodyType {
  TEXT = 'text',
  FILE = 'file',
}

export type TextBody = {
  type: RequestBodyType.TEXT;
  /** The body content as a string. Used for importing from third party collections. Usually, this is only stored on the file system */
  text?: string;
  /** The mime type of the file content, e.g. "application/json". May include an encoding */
  mimeType: string;
};

export type FileBody = {
  type: RequestBodyType.FILE;
  filePath?: string;
  fileName?: string;
  /** The mime type of the file content, e.g. "application/json". May include an encoding */
  mimeType?: string;
};

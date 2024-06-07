export type HttpHeaders = Record<string, string | string[] | undefined>;
export type RequestMethod =
  'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | 'CONNECT' | 'TRACE';

export type Request = {
  url: string;
  method: RequestMethod;
  headers: HttpHeaders;
  body: RequestBody | null;
  dirPath: string;
}

export type Response = {
  status: number;
  headers: HttpHeaders;
  duration: number;
  bodyFilePath: string | null;
}

export type RequestBody = TextBody | FileBody;

export type TextBody = {
  type: 'text';
  /** The body content as a string. Used for importing from third party collections. Usually, this is only stored on the file system */
  text?: string;
  /** The mime type of the file content, e.g. "application/json". May include an encoding */
  mimeType: string;
}

export type FileBody = {
  type: 'file';
  filePath: string;
}

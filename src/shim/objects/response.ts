import { HttpHeaders } from 'shim/headers';

export type TrufosResponse = {
  headers: HttpHeaders;
  metaInfo: MetaInfo;
  responseId?: string;
  autoFormat?: boolean;
};

export type MetaInfo = {
  duration: number;
  size: ResponseSize;
  status: number;
};

export type ResponseSize = {
  totalSizeInBytes: number;
  headersSizeInBytes: number;
  bodySizeInBytes: number;
};

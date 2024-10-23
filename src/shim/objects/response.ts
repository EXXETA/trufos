import { HttpHeaders } from 'shim/headers';

export type RufusResponse = {
  headers: HttpHeaders;
  metaInfo: MetaInfo;
  bodyFilePath?: string;
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

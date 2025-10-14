import { HttpHeaders } from 'shim/headers';

export type TrufosResponse = {
  type: 'response';
  headers: HttpHeaders;
  metaInfo: MetaInfo;
  id: string;
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

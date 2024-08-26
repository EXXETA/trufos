import { HttpHeaders } from 'shim/headers';

export type RufusResponse = {
  status: number;
  headers: HttpHeaders;
  duration: number;
  bodyFilePath?: string;
}
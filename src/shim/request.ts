import {RequestMethod} from "./requestMethod";
import {HttpHeaders, RequestBody} from "./http";

export interface Request {
  name?: string;
  url: string;
  method: RequestMethod;
  headers?: HttpHeaders;
  body?: RequestBody | null;
  dirPath?: string;
  changed: boolean;
}

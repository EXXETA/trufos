import {HttpHeaders} from "./headers";

export type RufusResponse = {
  status: number;
  headers: HttpHeaders;
  duration: number;
  bodyFilePath: string | null;
}
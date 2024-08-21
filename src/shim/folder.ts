import {RufusRequest} from "./request";

export type Folder = {
  id: string;
  parentId: string;
  type: "folder";
  title: string;
  children: (Folder | RufusRequest)[];
}
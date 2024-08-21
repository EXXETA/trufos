import {Folder} from "./folder";
import {RufusRequest} from "./request";
import {VariableObject} from "./variables";

export type Collection = {
  id: string;
  type: 'collection';
  title: string;
  dirPath: string;
  variables: Map<string, VariableObject>;
  children: (Folder | RufusRequest)[];
}
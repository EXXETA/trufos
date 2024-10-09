import { Folder } from 'shim/objects/folder';
import { RufusRequest } from 'shim/objects/request';
import { VariableObject } from 'shim/variables';

export type Collection = {
  id: string;
  type: 'collection';
  title: string;
  dirPath: string;
  variables: Record<string, VariableObject>;
  children: (Folder | RufusRequest)[];
  draft?: boolean;
}
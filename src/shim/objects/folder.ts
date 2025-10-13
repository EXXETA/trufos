import { TrufosRequest } from 'shim/objects/request';

export type Folder = {
  id: string;
  parentId: string;
  type: 'folder';
  title: string;
  children: (Folder | TrufosRequest)[];
  index?: number;
};

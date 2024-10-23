import { RufusRequest } from 'shim/objects/request';

export type Folder = {
  id: string;
  parentId: string;
  type: 'folder';
  title: string;
  children: (Folder | RufusRequest)[];
};

import { TrufosObject } from 'shim/objects';
import { RequestBody } from 'shim/objects/request';
import { VariableObject } from 'shim/variables';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosHeader } from 'shim/objects/headers';

export type RequestInfoFile = {
  version: string;
  title: string;
  url: string;
  method: RequestMethod;
  headers: TrufosHeader[];
  body: RequestBody;
};

export type FolderInfoFile = {
  version: string;
  title: string;
};

export type CollectionInfoFile = {
  version: string;
  title: string;
  variables: Record<string, VariableObject>;
};

export type InfoFile = RequestInfoFile | FolderInfoFile | CollectionInfoFile;

export function toInfoFile(object: TrufosObject): InfoFile {
  const infoFile = Object.assign({ version: '1.0.0' }, object);
  if (infoFile.type === 'request') {
    delete infoFile.draft;
  } else {
    delete infoFile.children;
  }
  if (infoFile.type !== 'collection') {
    delete infoFile.parentId;
  }
  delete infoFile.id;

  return infoFile;
}

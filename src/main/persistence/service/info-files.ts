import { RufusObject } from 'shim/objects';
import { RequestBody } from 'shim/objects/request';
import { VariableObject } from 'shim/variables';
import { RequestMethod } from 'shim/objects/requestMethod';
import { RufusHeader } from 'shim/objects/headers';

export type RequestInfoFile = {
  version: string;
  title: string;
  url: string;
  method: RequestMethod;
  headers: RufusHeader[];
  body: RequestBody;
}

export type FolderInfoFile = {
  version: string;
  title: string;
}

export type CollectionInfoFile = {
  version: string;
  title: string;
  variables: Record<string, VariableObject>;
}

export type InfoFile = RequestInfoFile | FolderInfoFile | CollectionInfoFile;

export function toInfoFile(object: RufusObject): InfoFile {
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

import { RufusObject } from 'shim/object';
import { RequestBody, RequestMethod } from 'shim/request';
import { HttpHeaders } from 'shim/headers';
import { VariableObject } from 'shim/variables';

export type RequestInfoFile = {
  version: string;
  title: string;
  url: string;
  method: RequestMethod;
  headers: HttpHeaders;
  body: RequestBody;
}

export type FolderInfoFile = {
  version: string;
  title: string;
}

export type CollectionInfoFile = {
  version: string;
  title: string;
  variables: Map<string, VariableObject>;
}

export type InfoFile = RequestInfoFile | FolderInfoFile | CollectionInfoFile;

export function toInfoFile(object: RufusObject): InfoFile {
  const infoFile = Object.assign({ version: '1.0.0' }, object);

  if (infoFile.type !== 'request') {
    delete infoFile.children;
  }

  if (infoFile.type !== 'collection') {
    delete infoFile.parentId;
  }

  delete infoFile.id;

  return infoFile;
}
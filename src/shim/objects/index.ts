import { TrufosRequest } from 'shim/objects/request';
import { Folder } from 'shim/objects/folder';
import { Collection } from 'shim/objects/collection';

export type TrufosObject = TrufosRequest | Folder | Collection;

export type TrufosObjectType = TrufosObject['type'];

export function isRequest(object: TrufosObject): object is TrufosRequest {
  return object.type === 'request';
}

export function isFolder(object: TrufosObject): object is Folder {
  return object.type === 'folder';
}

export function isCollection(object: TrufosObject): object is Collection {
  return object.type === 'collection';
}

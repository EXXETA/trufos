import { RufusRequest } from 'shim/objects/request';
import { Folder } from 'shim/objects/folder';
import { Collection } from 'shim/objects/collection';

export type RufusObject = RufusRequest | Folder | Collection;

export function isRequest(object: RufusObject): object is RufusRequest {
  return object.type === 'request';
}

export function isFolder(object: RufusObject): object is Folder {
  return object.type === 'folder';
}

export function isCollection(object: RufusObject): object is Collection {
  return object.type === 'collection';
}

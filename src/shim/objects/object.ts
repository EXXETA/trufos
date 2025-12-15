import { TrufosRequest } from './request';
import { Folder } from './folder';
import { Collection } from './collection';
import z from 'zod';

export const TrufosObject = z.discriminatedUnion('type', [TrufosRequest, Folder, Collection]);
export type TrufosObject = z.infer<typeof TrufosObject>;

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

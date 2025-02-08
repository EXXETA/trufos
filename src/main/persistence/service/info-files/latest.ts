import { TrufosObject } from 'shim/objects';
import { deleteProperty } from 'main/util/object-util';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';
import { InfoFile, VERSION, RequestInfoFile, FolderInfoFile, CollectionInfoFile } from './v1-1-0';

export { VERSION, InfoFile, CollectionInfoFile, FolderInfoFile, RequestInfoFile } from './v1-1-0';

/**
 * Deep clones the given object and removes any properties that are not allowed in an info file.
 * @param object The trufos object to convert to an info file.
 */
export function toInfoFile(object: TrufosObject): InfoFile {
  const infoFile = Object.assign(structuredClone(object), { version: VERSION.toString() });
  switch (infoFile.type) {
    case 'request':
      return deleteProperty(infoFile, 'type', 'parentId', 'draft');
    case 'collection':
      return deleteProperty(infoFile, 'type', 'dirPath', 'children');
    case 'folder':
      return deleteProperty(infoFile, 'type', 'parentId', 'children');
  }
}

export function fromCollectionInfoFile(
  infoFile: CollectionInfoFile,
  dirPath: string,
  children: Collection['children']
): Collection {
  return Object.assign(infoFile, {
    type: 'collection' as const,
    dirPath,
    children,
  });
}

export function fromFolderInfoFile(
  infoFile: FolderInfoFile,
  parentId: Folder['parentId'],
  children: Folder['children']
): Folder {
  return Object.assign(infoFile, { type: 'folder' as const, parentId, children });
}

export function fromRequestInfoFile(
  infoFile: RequestInfoFile,
  parentId: TrufosRequest['parentId']
): TrufosRequest {
  return Object.assign(infoFile, { type: 'request' as const, parentId });
}

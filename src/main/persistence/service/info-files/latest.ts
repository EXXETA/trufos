import { TrufosObject } from 'shim/objects';
import { deleteProperty } from 'main/util/object-util';
import { InfoFile, VERSION } from './v1-0-1';

export { VERSION, RequestInfoFile, FolderInfoFile, CollectionInfoFile, InfoFile } from './v1-0-1';

/**
 * Deep clones the given object and removes any properties that are not allowed in an info file.
 * @param object The trufos object to convert to an info file.
 */
export function toInfoFile(object: TrufosObject): InfoFile {
  const infoFile = Object.assign(structuredClone(object), { version: VERSION.toString() });
  switch (infoFile.type) {
    case 'request':
      return deleteProperty(infoFile, 'parentId', 'draft');
    case 'collection':
      return {
        ...deleteProperty(infoFile, 'children'),
        variables: Object.fromEntries(
          Object.entries(infoFile.variables).map(([key, variable]) => [
            key,
            deleteProperty(variable, 'key'),
          ])
        ),
      };
    case 'folder':
      return deleteProperty(infoFile, 'parentId', 'children');
  }
}

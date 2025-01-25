import { TrufosObject } from 'shim/objects';
import { RequestBody } from 'shim/objects/request';
import { VariableObject } from 'shim/variables';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosHeader } from 'shim/objects/headers';
import { deleteProperty } from 'main/util/object-util';
import { SemVer } from 'main/util/semver';

export const VERSION = new SemVer(1, 0, 1);

export type InfoFileBase = {
  id: string;
  version: typeof VERSION.string;
  title: string;
};

export type RequestInfoFile = InfoFileBase & {
  url: string;
  method: RequestMethod;
  headers: TrufosHeader[];
  body: RequestBody;
};

export type FolderInfoFile = InfoFileBase;

export type CollectionInfoFile = InfoFileBase & {
  variables: Record<VariableObject['key'], Omit<VariableObject, 'key'>>;
};

export type InfoFile = RequestInfoFile | FolderInfoFile | CollectionInfoFile;

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
        ...deleteProperty(infoFile, 'variables', 'children'),
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

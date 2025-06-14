import { TrufosObject } from 'shim/objects';
import { omit } from 'main/util/object-util';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';
import { InfoFile, VERSION, RequestInfoFile, FolderInfoFile, CollectionInfoFile } from './v1-2-0';
import { VariableMap } from 'shim/objects/variables';

export { VERSION, InfoFile, CollectionInfoFile, FolderInfoFile, RequestInfoFile } from './v1-2-0';

/**
 * Deep clones the given object and removes any properties that are not allowed in an info file.
 * @param object The trufos object to convert to an info file.
 */
export function toInfoFile(object: TrufosObject): InfoFile {
  const { id, title, ...rest } = object;
  const infoFile: TrufosObject & { version: typeof VERSION.string } = {
    id,
    title,
    version: VERSION.toString(),
    ...rest,
  }; // this is a shallow copy which has id and title on top of the JSON

  switch (infoFile.type) {
    case 'request':
      return omit(infoFile, 'type', 'parentId', 'draft', 'queryParams');
    case 'collection':
      return omit(infoFile, 'type', 'dirPath', 'children');
    case 'folder':
      return omit(infoFile, 'type', 'parentId', 'children');
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
  parentId: TrufosRequest['parentId'],
  draft: boolean
): TrufosRequest {
  return Object.assign(infoFile, { type: 'request' as const, parentId, draft, queryParams: [] });
}

/**
 * Extracts secrets from the given variables map and removes them from the original map.
 * @param variables The variables map to extract secrets from.
 */
function extractSecretsFromMap(variables: VariableMap): VariableMap {
  const secrets: VariableMap = {};
  for (const [key, variable] of Object.entries(variables)) {
    if (variable.secret) {
      secrets[key] = variable;
      delete variables[key];
    }
  }
  return secrets;
}

/**
 * Extracts and removes all secrets from the given collection and returns a partial collection that
 * contains all removed secrets. It's like splitting the secrets from the collection so that the given
 * collection can be saved in plain text.
 * @param collection The Trufos object from which to extract secrets. They will be removed from it.
 */
export function extractSecrets(collection: Collection): Partial<Collection> {
  return {
    variables: extractSecretsFromMap(collection.variables),
    environments: Object.fromEntries(
      Object.entries(collection.environments).map(([key, value]) => [
        key,
        {
          variables: extractSecretsFromMap(value.variables),
        },
      ])
    ),
  };
}

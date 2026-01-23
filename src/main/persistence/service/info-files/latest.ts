import { TrufosObject } from 'shim/objects';
import { omit, split } from 'main/util/object-util';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';
import { VariableMap } from 'shim/objects/variables';
import { InfoFile, VERSION, RequestInfoFile, FolderInfoFile, CollectionInfoFile } from './v2-1-0';

export { createGitIgnore } from './v2-0-0';
export { VERSION, InfoFile, CollectionInfoFile, FolderInfoFile, RequestInfoFile } from './v2-1-0';

export const GIT_IGNORE_FILE_NAME = '.gitignore';

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
      return omit(infoFile, 'type', 'parentId', 'draft');
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
  delete infoFile.version;
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
  delete infoFile.version;
  return Object.assign(infoFile, { type: 'folder' as const, parentId, children });
}

export function fromRequestInfoFile(
  infoFile: RequestInfoFile,
  parentId: TrufosRequest['parentId'],
  draft: boolean
): TrufosRequest {
  delete infoFile.version;
  return Object.assign(infoFile, { type: 'request' as const, parentId, draft });
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
 * Extracts and removes all secrets from the given trufos object and returns the partial object that
 * contains all removed secrets. It's like splitting the secrets from the object so that it can be saved in plain text.
 * @param object The Trufos object from which to extract secrets. They will be removed from it.
 * @return A partial Trufos object containing the secrets that were removed.
 */
export function extractSecrets(object: TrufosObject): Partial<TrufosObject> {
  switch (object.type) {
    case 'collection':
      return {
        variables: extractSecretsFromMap(object.variables),
        environments: Object.fromEntries(
          Object.entries(object.environments).map(([key, value]) => [
            key,
            {
              variables: extractSecretsFromMap(value.variables),
            },
          ])
        ),
        ...split(object, 'auth'),
      };
    case 'request':
      return split(object, 'auth');
    case 'folder':
      return {};
  }
}

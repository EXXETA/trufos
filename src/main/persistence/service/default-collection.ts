import { Collection } from 'shim/objects/collection';
import { RequestBodyType } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { randomUUID } from 'node:crypto';

export function generateDefaultCollection(dirPath: string): Collection {
  const collectionId = randomUUID();
  const folderId = randomUUID();
  const exampleRequestId = randomUUID();
  const anotherRequestId = randomUUID();

  return {
    id: collectionId,
    type: 'collection',
    title: 'Default Collection',
    dirPath,
    variables: {
      'variable-1': {
        enabled: true,
        value: 'value-1',
      },
      'variable-2': {
        enabled: true,
        value: 'value-2',
      },
    },
    children: [
      {
        id: exampleRequestId,
        parentId: collectionId,
        type: 'request',
        title: 'Example Request',
        url: 'https://github.com/EXXETA/trufos/raw/main/README.md',
        method: RequestMethod.GET,
        headers: [],
        body: {
          type: RequestBodyType.TEXT,
          mimeType: 'text/plain',
          text: '',
        },
      },
      {
        id: folderId,
        parentId: collectionId,
        type: 'folder',
        title: 'Example Folder',
        children: [
          {
            id: anotherRequestId,
            parentId: folderId,
            type: 'request',
            title: 'Another Request',
            url: 'https://exxeta.com/',
            method: RequestMethod.GET,
            headers: [],
            body: {
              type: RequestBodyType.TEXT,
              mimeType: 'application/json',
            },
          },
        ],
      },
    ],
  };
}

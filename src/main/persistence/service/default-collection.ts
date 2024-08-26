import { Collection } from 'shim/collection';
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
    variables: new Map(),
    children: [
      {
        id: exampleRequestId,
        parentId: collectionId,
        type: 'request',
        title: 'Example Request',
        url: 'https://github.com/EXXETA/rufus/raw/main/README.md',
        method: 'GET',
        headers: {},
        body: null,
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
            method: 'GET',
            headers: {},
            body: {
              type: 'text',
              mimeType: 'application/json',
              text: '{"key": "value"}',
            },
          },
        ],
      },
    ],
  };
}

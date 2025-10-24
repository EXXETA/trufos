import { Collection } from 'shim/objects/collection';
import { RequestBodyType } from 'shim/objects/request';
import { parseUrl } from 'shim/objects/url';
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
    variables: Object.fromEntries(
      [
        {
          key: 'variable1',
          value: 'value-1',
        },
        {
          key: 'variable2',
          value: 'value2',
        },
      ].map((variable) => [variable.key, variable])
    ),
    environments: {},
    children: [
      {
        id: exampleRequestId,
        parentId: collectionId,
        type: 'request',
        title: 'Example Request',
        url: parseUrl('https://echo.free.beeceptor.com'),
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
            url: parseUrl('https://exxeta.com/'),
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

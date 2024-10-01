import { Collection } from 'shim/objects/collection';
import { v4 as uuidv4 } from 'uuid';
import { RequestBodyType } from 'shim/objects/request';
import {RequestMethod} from "shim/objects/requestMethod";

export function generateDefaultCollection(dirPath: string): Collection {
  const collectionId = uuidv4();
  const folderId = uuidv4();
  const exampleRequestId = uuidv4();
  const anotherRequestId = uuidv4();

  return {
    id: collectionId,
    type: 'collection',
    title: 'Default Collection',
    dirPath,
    variables: {
      'variable-1': {
        enabled: true,
        value: 'value-1'
      },
      'variable-2': {
        enabled: true,
        value: 'value-2'
      }
    },
    children: [
      {
        id: exampleRequestId,
        parentId: collectionId,
        type: 'request',
        title: 'Example Request',
        url: 'https://github.com/EXXETA/rufus/raw/main/README.md',
        method: RequestMethod.get,
        headers: {},
        body: null
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
            method: RequestMethod.get,
            headers: {},
            body: {
              type: RequestBodyType.TEXT,
              mimeType: 'application/json',
              text: '{"key": "value"}'
            }
          }
        ]
      }
    ]
  };
}

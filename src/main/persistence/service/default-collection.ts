import { Collection } from "shim/collection";
import { v4 as uuidv4 } from "uuid";

export function generateDefaultCollection(dirPath: string): Collection {
  const collectionId = uuidv4();
  const folderId = uuidv4();
  const exampleRequestId = uuidv4();
  const anotherRequestId = uuidv4();

  return {
    id: collectionId,
    type: "collection",
    title: "Default Collection",
    dirPath,
    variables: new Map(),
    children: [
      {
        id: exampleRequestId,
        parentId: collectionId,
        type: "request",
        title: "Example Request",
        url: "https://github.com/EXXETA/rufus/raw/main/README.md",
        method: "GET",
        headers: {},
        body: null,
      },
      {
        id: folderId,
        parentId: collectionId,
        type: "folder",
        title: "Example Folder",
        children: [
          {
            id: anotherRequestId,
            parentId: folderId,
            type: "request",
            title: "Another Request",
            url: "https://exxeta.com/",
            method: "GET",
            headers: {},
            body: {
              type: "text",
              mimeType: "application/json",
              text: "abc",
            },
          },
        ],
      },
    ],
  };
}
import { describe, expect, it } from 'vitest';
import { CollectionInfoFile, InfoFile, RequestInfoFile, toInfoFile } from './latest';
import COLLECTION_INFO_FILE from '../../../../../examples/collection/collection.json';
import REQUEST_INFO_FILE from '../../../../../examples/collection/echo/request.json';
import { Collection, Folder, parseUrl, RequestBodyType, RequestMethod, TrufosRequest } from 'shim';

describe('latest InfoFile schema', async () => {
  it('should accept a valid latest InfoFile', async () => {
    // Act & Assert
    await expect(COLLECTION_INFO_FILE).toBeOfSchemaAsync(CollectionInfoFile);
    await expect(REQUEST_INFO_FILE).toBeOfSchemaAsync(RequestInfoFile);
    await expect(COLLECTION_INFO_FILE).toBeOfSchemaAsync(InfoFile);
    await expect(REQUEST_INFO_FILE).toBeOfSchemaAsync(InfoFile);
  });

  it('should reject an invalid latest InfoFile', async () => {
    // Arrange
    const invalidCollectionInfoFile = structuredClone(COLLECTION_INFO_FILE);
    // @ts-expect-error Invalid type, should be string
    invalidCollectionInfoFile.title = 123;

    // Act & Assert
    await expect(invalidCollectionInfoFile).not.toBeOfSchemaAsync(CollectionInfoFile);
  });
});

describe('toInfoFile', async () => {
  it('should omit correct attributes for requsts', async () => {
    // Arrange
    const request: TrufosRequest = {
      id: 'request-id',
      parentId: 'parent-id',
      type: 'request',
      title: 'Request Title',
      url: parseUrl('https://example.com'),
      method: RequestMethod.GET,
      headers: [],
      body: {
        type: RequestBodyType.TEXT,
        mimeType: 'text/plain',
        text: 'Hello, world!',
      },
      draft: false,
    };
    // Act
    const actualInfoFile = toInfoFile(request);
    // Assert
    expect('type' in actualInfoFile).toBe(false);
    expect('parentId' in actualInfoFile).toBe(false);
    expect('draft' in actualInfoFile).toBe(false);
  });

  it('should omit correct attributes for collections', async () => {
    // Arrange
    const request: Collection = {
      type: 'collection',
      id: 'collection-id',
      title: 'Request Title',
      dirPath: '/path/to/collection',
      isDefault: true,
      variables: {},
      environments: {},
      children: [
        {
          type: 'folder',
          id: 'folder-id',
          parentId: 'collection-id',
          title: 'Folder Title',
          children: [],
        },
      ],
    };
    // Act
    const actualInfoFile = toInfoFile(request);
    // Assert
    expect('type' in actualInfoFile).toBe(false);
    expect('isDefault' in actualInfoFile).toBe(false);
    expect('dirPath' in actualInfoFile).toBe(false);
    expect('children' in actualInfoFile).toBe(false);
  });

  it('should omit correct attributes for folders', async () => {
    // Arrange
    const request: Folder = {
      type: 'folder',
      id: 'folder-id',
      parentId: 'collection-id',
      title: 'Folder Title',
      children: [],
    };
    // Act
    const actualInfoFile = toInfoFile(request);
    // Assert
    expect('type' in actualInfoFile).toBe(false);
    expect('parentId' in actualInfoFile).toBe(false);
    expect('children' in actualInfoFile).toBe(false);
  });
});

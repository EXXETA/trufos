import { describe, expect, it } from 'vitest';
import { CollectionInfoFile, InfoFile, RequestInfoFile } from './latest';
import COLLECTION_INFO_FILE from '../../../../../examples/collection/collection.json';
import REQUEST_INFO_FILE from '../../../../../examples/collection/echo/request.json';

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

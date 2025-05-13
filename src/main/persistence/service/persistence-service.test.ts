import { Collection } from 'shim/objects/collection';
import path from 'node:path';
import { generateDefaultCollection } from './default-collection';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { Folder } from 'shim/objects/folder';
import { randomUUID } from 'node:crypto';
import {
  DRAFT_TEXT_BODY_FILE_NAME,
  RequestBodyType,
  TrufosRequest,
  TEXT_BODY_FILE_NAME,
} from 'shim/objects/request';
import { RequestInfoFile } from './info-files/latest';
import { RequestMethod } from 'shim/objects/request-method';
import { Readable } from 'node:stream';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { exists, USER_DATA_DIR } from 'main/util/fs-util';
import { PersistenceService } from './persistence-service';

const persistenceService = PersistenceService.instance;

const collectionDirPath = path.join(USER_DATA_DIR, 'default-collection');

function getExampleCollection(): Collection {
  return {
    id: randomUUID(),
    type: 'collection',
    title: 'collection',
    children: [],
    variables: {},
    environments: {},
    dirPath: path.join(USER_DATA_DIR, 'collections', randomUUID()),
  };
}

function getExampleFolder(parentId: string): Folder {
  return {
    id: randomUUID(),
    type: 'folder',
    title: 'folder',
    children: [],
    parentId,
  };
}

function getExampleRequest(parentId: string): TrufosRequest {
  return {
    id: randomUUID(),
    url: 'https://example.com',
    headers: [],
    type: 'request',
    title: 'request',
    draft: false,
    parentId,
    method: RequestMethod.GET,
    queryParams: [],
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
  };
}

async function streamToString(stream: Readable) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

describe('PersistenceService', () => {
  let collection: Collection;
  beforeEach(async () => {
    collection = getExampleCollection();
    await mkdir(collection.dirPath, { recursive: true });
  });

  it('createDefaultCollectionIfNotExists() should not create if it already exists', async () => {
    // Arrange
    const defaultCollectionImport = await import('./default-collection');
    const generateDefaultCollectionSpy = vi.spyOn(
      defaultCollectionImport,
      'generateDefaultCollection'
    );
    await mkdir(collectionDirPath);
    await writeFile(path.join(collectionDirPath, 'collection.json'), '');

    // Act
    await persistenceService.createDefaultCollectionIfNotExists();

    // Assert
    expect(generateDefaultCollectionSpy).not.toHaveBeenCalled();
  });

  it('createDefaultCollectionIfNotExists() should create a new default collection if does not exist', async () => {
    // Arrange
    const defaultCollectionImport = await import('./default-collection');
    const defaultCollection = {} as Collection;
    vi.spyOn(defaultCollectionImport, 'generateDefaultCollection').mockReturnValueOnce(
      defaultCollection
    );
    const saveCollectionRecursiveSpy = vi
      .spyOn(persistenceService, 'saveCollectionRecursive')
      .mockResolvedValueOnce();

    // Act
    await persistenceService.createDefaultCollectionIfNotExists();

    // Assert
    expect(generateDefaultCollection).toHaveBeenCalledWith(collectionDirPath);
    expect(saveCollectionRecursiveSpy).toHaveBeenCalledWith(defaultCollection);
  });

  it('moveChild() should move the directory from the old parent to the new parent', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);
    const request = getExampleRequest(folder.id);
    folder.children.push(request);

    await persistenceService.saveCollectionRecursive(collection);

    // Assert
    expect(await exists(path.join(collection.dirPath, folder.title))).toBe(true);
    expect(await exists(path.join(collection.dirPath, folder.title, request.title))).toBe(true);

    // Act
    await persistenceService.moveChild(request, folder, collection);

    // Assert
    expect(await exists(path.join(collection.dirPath, request.title))).toBe(true);
    expect(await exists(path.join(collection.dirPath, folder.title, request.title))).toBe(false);
  });

  it('rename() should rename the directory of a collection', async () => {
    // Arrange
    const oldDirPath = collection.dirPath;

    await mkdir(oldDirPath, { recursive: true });

    // Assert
    expect(await exists(oldDirPath)).toBe(true);

    // Act
    await persistenceService.rename(collection, randomUUID());

    // Assert
    expect(await exists(collection.dirPath)).toBe(true);
    expect(await exists(oldDirPath)).toBe(false);
  });

  it('rename() should rename the directory of a folder', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);
    const oldDirPath = path.join(collection.dirPath, folder.title);

    await persistenceService.saveCollectionRecursive(collection);

    // Assert
    expect(await exists(oldDirPath)).toBe(true);

    // Act
    await persistenceService.rename(folder, randomUUID());

    // Assert
    const newDirPath = path.join(collection.dirPath, folder.title);
    expect(await exists(newDirPath)).toBe(true);
    expect(await exists(oldDirPath)).toBe(false);
  });

  it('saveRequest() should save the metadata of the request', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);

    await persistenceService.saveCollectionRecursive(collection);

    const oldInfo = JSON.parse(
      await readFile(path.join(collection.dirPath, request.title, 'request.json'), 'utf-8')
    ) as RequestInfoFile;
    request.method = RequestMethod.PUT;

    // Assert
    expect(oldInfo.method).not.toBe(request.method);

    // Act
    await persistenceService.saveRequest(request);

    // Assert
    const newInfo = JSON.parse(
      await readFile(path.join(collection.dirPath, request.title, 'request.json'), 'utf-8')
    ) as RequestInfoFile;
    expect(newInfo.method).toBe(request.method);
    expect(newInfo).not.toEqual(oldInfo);
  });

  it('saveCollection() should save the metadata of the collection', async () => {
    // Act
    await persistenceService.saveCollection(collection);

    // Assert
    expect(await exists(path.join(collection.dirPath, 'collection.json'))).toBe(true);
  });

  it('saveRequest() should find an unused directory name', async () => {
    // Arrange requests
    const firstRequest = { ...getExampleRequest(collection.id), title: 'A B' };
    const secondRequest = { ...getExampleRequest(collection.id), title: 'A-B' };
    const thirdRequest = { ...getExampleRequest(collection.id), title: 'a b' };
    const expectedFirstDirPath = path.join(collection.dirPath, 'a-b');
    const expectedSecondDirPath = path.join(collection.dirPath, 'a-b-2');
    const expectedThirdDirPath = path.join(collection.dirPath, 'a-b-3');

    expect(await exists(expectedFirstDirPath)).toBe(false);
    expect(await exists(expectedSecondDirPath)).toBe(false);
    expect(await exists(expectedThirdDirPath)).toBe(false);

    await persistenceService.saveCollectionRecursive(collection);

    // Act
    collection.children.push(firstRequest);
    await persistenceService.saveRequest(firstRequest);

    // Assert
    expect(await exists(expectedFirstDirPath)).toBe(true);
    expect(await exists(expectedSecondDirPath)).toBe(false);
    expect(await exists(expectedThirdDirPath)).toBe(false);

    // Act
    collection.children.push(secondRequest);
    await persistenceService.saveRequest(secondRequest);

    // Assert
    expect(await exists(expectedFirstDirPath)).toBe(true);
    expect(await exists(expectedSecondDirPath)).toBe(true);
    expect(await exists(expectedThirdDirPath)).toBe(false);

    // Act
    collection.children.push(thirdRequest);
    await persistenceService.saveRequest(thirdRequest);

    // Assert
    expect(await exists(expectedFirstDirPath)).toBe(true);
    expect(await exists(expectedSecondDirPath)).toBe(true);
    expect(await exists(expectedThirdDirPath)).toBe(true);
  });

  it('saveFolder() should save the metadata of the folder', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);
    const folderInfoFilePath = path.join(collection.dirPath, folder.title, 'folder.json');

    await persistenceService.saveCollectionRecursive(collection);
    await rm(folderInfoFilePath);

    // Assert
    expect(await exists(folderInfoFilePath)).toBe(false);

    // Act
    await persistenceService.saveFolder(folder);

    // Assert
    expect(await exists(folderInfoFilePath)).toBe(true);
  });

  it('saveCollectionRecursive() should save the collection and its children', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);
    const request = getExampleRequest(folder.id);
    folder.children.push(request);

    // Act
    await persistenceService.saveCollectionRecursive(collection);

    // Assert
    expect(await exists(path.join(collection.dirPath, 'collection.json'))).toBe(true);
    expect(await exists(path.join(collection.dirPath, folder.title, 'folder.json'))).toBe(true);
    expect(
      await exists(path.join(collection.dirPath, folder.title, request.title, 'request.json'))
    ).toBe(true);
  });

  it('saveChanges() should overwrite the request metadata with its draft metadata', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);

    await persistenceService.saveCollectionRecursive(collection);

    request.draft = true;
    request.method = RequestMethod.POST;

    await persistenceService.saveRequest(request);
    let originalInfo = JSON.parse(
      await readFile(path.join(collection.dirPath, request.title, 'request.json'), 'utf-8')
    ) as RequestInfoFile;
    const draftInfo = JSON.parse(
      await readFile(path.join(collection.dirPath, request.title, '~request.json'), 'utf-8')
    ) as RequestInfoFile;

    // Assert
    expect(await exists(path.join(collection.dirPath, request.title, 'request.json'))).toBe(true);
    expect(await exists(path.join(collection.dirPath, request.title, '~request.json'))).toBe(true);
    expect(originalInfo).not.toEqual(draftInfo);

    // Act
    await persistenceService.saveChanges(request);

    // Assert
    expect(await exists(path.join(collection.dirPath, request.title, 'request.json'))).toBe(true);
    expect(await exists(path.join(collection.dirPath, request.title, '~request.json'))).toBe(false);
    originalInfo = JSON.parse(
      await readFile(path.join(collection.dirPath, request.title, 'request.json'), 'utf-8')
    ) as RequestInfoFile;
    expect(originalInfo).toEqual(draftInfo);
  });

  it('discardChanges() should delete the draft metadata and keep the original', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);

    await persistenceService.saveCollectionRecursive(collection);

    request.draft = true;
    request.method = RequestMethod.POST;

    await persistenceService.saveRequest(request);
    const oldInfo = JSON.parse(
      await readFile(path.join(collection.dirPath, request.title, 'request.json'), 'utf-8')
    ) as RequestInfoFile;

    // Assert
    expect(await exists(path.join(collection.dirPath, request.title, 'request.json'))).toBe(true);
    expect(await exists(path.join(collection.dirPath, request.title, '~request.json'))).toBe(true);

    // Act
    await persistenceService.discardChanges(request);

    // Assert
    expect(await exists(path.join(collection.dirPath, request.title, 'request.json'))).toBe(true);
    expect(await exists(path.join(collection.dirPath, request.title, '~request.json'))).toBe(false);
    const newInfo = JSON.parse(
      await readFile(path.join(collection.dirPath, request.title, 'request.json'), 'utf-8')
    ) as RequestInfoFile;
    expect(oldInfo).toEqual(newInfo);
  });

  it('delete() should delete the directory of a trufos object', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);

    await persistenceService.saveCollectionRecursive(collection);

    // Assert
    expect(await exists(path.join(collection.dirPath, folder.title))).toBe(true);

    // Act
    await persistenceService.delete(folder);

    // Assert
    expect(await exists(path.join(collection.dirPath, folder.title))).toBe(false);
  });

  it('loadTextBodyOfRequest() should load the text body of a request', async () => {
    // Arrange
    const textBody = 'text body';
    const request = getExampleRequest(collection.id);
    collection.children.push(request);

    await persistenceService.saveCollectionRecursive(collection);
    await persistenceService.saveRequest(request, textBody);

    // Assert
    expect(await exists(path.join(collection.dirPath, request.title, TEXT_BODY_FILE_NAME))).toBe(
      true
    );
    expect(
      await exists(path.join(collection.dirPath, request.title, DRAFT_TEXT_BODY_FILE_NAME))
    ).toBe(false);

    // Act
    const result = await persistenceService.loadTextBodyOfRequest(request);

    // Assert
    expect(await streamToString(result)).toBe(textBody);
  });

  it('loadTextBodyOfRequest() should load the text body of a request with utf8', async () => {
    // Arrange
    const textBody = 'text body';
    const request = getExampleRequest(collection.id);
    collection.children.push(request);

    await persistenceService.saveCollectionRecursive(collection);
    await persistenceService.saveRequest(request, textBody);

    // Act
    const result = (
      await Array.fromAsync(await persistenceService.loadTextBodyOfRequest(request, 'utf8'))
    ).join('');

    // Assert
    expect(result).toBe(textBody);
  });

  it('loadTextBodyOfRequest() should load the text body of a draft request', async () => {
    // Arrange
    const textBody = 'text body';
    const request = getExampleRequest(collection.id);
    request.draft = true;
    collection.children.push(request);

    await persistenceService.saveCollectionRecursive(collection);
    await persistenceService.saveRequest(request, textBody);

    // Assert
    expect(await exists(path.join(collection.dirPath, request.title, TEXT_BODY_FILE_NAME))).toBe(
      false
    );
    expect(
      await exists(path.join(collection.dirPath, request.title, DRAFT_TEXT_BODY_FILE_NAME))
    ).toBe(true);

    // Act
    const result = await persistenceService.loadTextBodyOfRequest(request);

    // Assert
    expect(await streamToString(result)).toBe(textBody);
  });

  it('loadCollection() should load the collection and its children at the given directory', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);

    await persistenceService.saveCollectionRecursive(collection);
    await mkdir(path.join(collection.dirPath, 'invalid-directory')); // create data garbage

    // Act
    const result = await persistenceService.loadCollection(collection.dirPath);

    // Assert
    expect(result).not.toBeNull();
    result.id = collection.id;
    expect(result.children).toHaveLength(1);
    result.children[0].id = folder.id;
    result.children[0].parentId = collection.id;
    expect(result).toEqual(collection);
  });

  it('loadCollection() without recursive flag should load the basic collection at the given directory', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);

    await persistenceService.saveCollectionRecursive(collection);

    // Act
    const result = await persistenceService.loadCollection(collection.dirPath, false);

    // Arrange
    delete collection.type;
    delete collection.children;
    delete collection.dirPath;

    // Assert
    expect(result).toEqual(collection);
  });
});

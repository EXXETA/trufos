import { exists, USER_DATA_DIR } from 'main/util/fs-util';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TEXT_BODY_FILE_NAME, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { VariableMap, VariableObject } from 'shim/objects/variables';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDefaultCollection } from './default-collection';
import { sanitizeTitle } from 'shim/fs';
import { CollectionInfoFile, RequestInfoFile, GIT_IGNORE_FILE_NAME } from './info-files/latest';
import { PersistenceService } from './persistence-service';
import { DRAFT_DIR_NAME, SECRETS_FILE_NAME } from 'main/persistence/constants';

const persistenceService = PersistenceService.instance;

const collectionDirPath = path.join(USER_DATA_DIR, 'default-collection');

function getExampleCollection(): Collection {
  return {
    id: randomUUID(),
    type: 'collection',
    title: 'collection',
    isDefault: false,
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

function getExampleFolderWithChildren(parentId: string): Folder {
  const folder = getExampleFolder(parentId);

  const childFolder = getExampleFolder(folder.id);
  const childFolderRequest = getExampleRequest(childFolder.id);
  childFolder.children.push(childFolderRequest);

  const childRequest = getExampleRequest(folder.id);

  folder.children.push(childFolder);
  folder.children.push(childRequest);

  return folder;
}

function getExampleRequest(parentId: string): TrufosRequest {
  return {
    id: randomUUID(),
    url: { base: 'https://example.com', query: [] },
    headers: [],
    type: 'request',
    title: 'request',
    draft: false,
    parentId,
    method: RequestMethod.GET,
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
    const defaultCollectionImport = await import('./default-collection.js');
    const generateDefaultCollectionSpy = vi.spyOn(
      defaultCollectionImport,
      'generateDefaultCollection'
    );
    await mkdir(collectionDirPath);
    await writeFile(
      path.join(collectionDirPath, persistenceService.getInfoFileName(collection.type)),
      ''
    );

    // Act
    await persistenceService.createDefaultCollectionIfNotExists();

    // Assert
    expect(generateDefaultCollectionSpy).not.toHaveBeenCalled();
  });

  it('createDefaultCollectionIfNotExists() should create a new default collection if does not exist', async () => {
    // Arrange
    const defaultCollectionImport = await import('./default-collection.js');
    const defaultCollection = {} as Collection;
    vi.spyOn(defaultCollectionImport, 'generateDefaultCollection').mockReturnValueOnce(
      defaultCollection
    );
    const saveCollectionSpy = vi
      .spyOn(persistenceService, 'saveCollection')
      .mockResolvedValueOnce();

    // Act
    await persistenceService.createDefaultCollectionIfNotExists();

    // Assert
    expect(generateDefaultCollection).toHaveBeenCalledWith(collectionDirPath);
    expect(saveCollectionSpy).toHaveBeenCalledWith(defaultCollection, true);
  });

  it('moveChild() should move the directory from the old parent to the new parent', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);
    const request = getExampleRequest(folder.id);
    folder.children.push(request);

    await persistenceService.saveCollection(collection, true);

    // Assert
    expect(await exists(path.join(collection.dirPath, folder.title))).toBe(true);
    expect(await exists(path.join(collection.dirPath, folder.title, request.title))).toBe(true);

    // Act
    await persistenceService.moveChild(request, folder, collection);

    // Assert
    expect(await exists(path.join(collection.dirPath, request.title))).toBe(true);
    expect(await exists(path.join(collection.dirPath, folder.title, request.title))).toBe(false);
  });

  it('rename() should rename the directory of a folder', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);
    const oldDirPath = path.join(collection.dirPath, folder.title);

    await persistenceService.saveCollection(collection, true);

    // Assert
    expect(await exists(oldDirPath)).toBe(true);

    // Act
    await persistenceService.rename(folder, randomUUID());

    // Assert
    const newDirPath = path.join(collection.dirPath, folder.title);
    expect(await exists(newDirPath)).toBe(true);
    expect(await exists(oldDirPath)).toBe(false);
  });

  it('rename() should update info file title and keep children accessible after folder rename', async () => {
    // Arrange
    const folder = getExampleFolderWithChildren(collection.id);
    collection.children.push(folder);
    const child = getExampleFolder(folder.id);
    folder.children.push(child);

    await persistenceService.saveCollection(collection, true);
    const oldChildDirPath = path.join(
      collection.dirPath,
      sanitizeTitle(folder.title),
      sanitizeTitle(child.title)
    );
    expect(await exists(oldChildDirPath)).toBe(true);

    const newTitle = folder.title + ' Renamed';
    const expectedNewPath = path.join(collection.dirPath, sanitizeTitle(newTitle));

    // Act
    await persistenceService.rename(folder, newTitle);

    // Assert: directory moved
    expect(await exists(expectedNewPath)).toBe(true);
    expect(await exists(oldChildDirPath)).toBe(false);

    // Assert: child folder new path exists
    const newChildFolderPath = path.join(
      expectedNewPath,
      persistenceService.getInfoFileName('folder')
    );
    expect(await exists(newChildFolderPath)).toBe(true);

    // Info file title updated
    const info = JSON.parse(
      await readFile(
        path.join(expectedNewPath, persistenceService.getInfoFileName('folder')),
        'utf-8'
      )
    );
    expect(info.title).toBe(newTitle);
  });

  it('rename() should persist new title for a request even if directory name unchanged', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    request.title = 'Same %Title%'; // sanitized stays same
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    const requestDirPath = path.join(collection.dirPath, sanitizeTitle(request.title));
    expect(await exists(requestDirPath)).toBe(true);

    // Act
    await persistenceService.rename(request, 'Same $Title$'); // sanitized collides -> no dir rename, only title change

    // Assert: file still exists
    expect(await exists(requestDirPath)).toBe(true);
    const info = JSON.parse(
      await readFile(
        path.join(requestDirPath, persistenceService.getInfoFileName('request')),
        'utf-8'
      )
    );
    expect(info.title).toBe('Same $Title$');
  });

  it('rename() should append a number if target directory already exists', async () => {
    // Arrange
    const folderA = getExampleFolder(collection.id);
    folderA.title = 'FolderA';
    const folderB = getExampleFolder(collection.id);
    folderB.title = 'FolderB';
    collection.children.push(folderA, folderB);
    await persistenceService.saveCollection(collection, true);
    const expectedDirPath = path.join(collection.dirPath, 'folderb-2');

    // Act
    await persistenceService.rename(folderA, 'FolderB');

    // Assert
    expect(await exists(expectedDirPath)).toBe(true);
  });

  it('saveRequest() should save the metadata of the request', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);

    await persistenceService.saveCollection(collection, true);
    const oldInfo = JSON.parse(
      await readFile(
        path.join(
          collection.dirPath,
          request.title,
          persistenceService.getInfoFileName(request.type)
        ),
        'utf-8'
      )
    ) as RequestInfoFile;
    request.method = RequestMethod.PUT;

    // Assert
    expect(oldInfo.method).not.toBe(request.method);

    // Act
    await persistenceService.saveRequest(request);

    // Assert
    const newInfo = JSON.parse(
      await readFile(
        path.join(
          collection.dirPath,
          request.title,
          persistenceService.getInfoFileName(request.type)
        ),
        'utf-8'
      )
    ) as RequestInfoFile;
    expect(newInfo.method).toBe(request.method);
    expect(newInfo).not.toEqual(oldInfo);
  });

  it('saveCollection() should save the metadata of the collection', async () => {
    // Act
    await persistenceService.saveCollection(collection);

    // Assert
    expect(
      await exists(
        path.join(collection.dirPath, persistenceService.getInfoFileName(collection.type))
      )
    ).toBe(true);
  });

  it('saveCollection() should store the secrets only in ~secrets.json.bin', async () => {
    // Arrange
    const secretVariable: VariableObject = { value: 'secret', secret: true };
    const plainVariable: VariableObject = { value: 'plain' };
    const variables: VariableMap = { secret: secretVariable, plain: plainVariable };
    collection.variables = structuredClone(variables);
    collection.environments.dev = { variables: structuredClone(variables) };

    // Act
    await persistenceService.saveCollection(collection);

    // Assert
    const info = JSON.parse(
      await readFile(
        path.join(collection.dirPath, persistenceService.getInfoFileName(collection.type)),
        'utf-8'
      )
    ) as CollectionInfoFile;
    expect(info.variables).toEqual(
      Object.fromEntries(Object.entries(variables).filter(([, v]) => !v.secret))
    );
    const secrets = JSON.parse(
      await readFile(path.join(collection.dirPath, SECRETS_FILE_NAME), 'utf-8')
    ) as Partial<CollectionInfoFile>;
    expect(secrets.variables).toEqual(
      Object.fromEntries(Object.entries(variables).filter(([, v]) => v.secret))
    );
  });

  it('saveCollection(recursive=true) should create .gitignore when directory does not exist', async () => {
    // Arrange
    const newCollection = getExampleCollection();
    await rm(newCollection.dirPath, { recursive: true, force: true });
    const gitignorePath = path.join(newCollection.dirPath, GIT_IGNORE_FILE_NAME);

    // Act
    await persistenceService.saveCollection(newCollection, true);

    // Assert
    expect(await exists(gitignorePath)).toBe(true);
  });

  it('saveCollection(recursive=true) should create .gitignore when directory does exists but gitignore is missing', async () => {
    // Arrange
    const newCollection = getExampleCollection();

    // Act
    await persistenceService.saveCollection(newCollection, true);

    // Assert
    expect(await exists(path.join(newCollection.dirPath, GIT_IGNORE_FILE_NAME))).toBe(true);
  });

  it('saveCollection(recursive=true) should not modify .gitignore if it already exists', async () => {
    // Arrange
    const newCollection = getExampleCollection();
    await mkdir(newCollection.dirPath, { recursive: true });
    const gitignorePath = path.join(newCollection.dirPath, GIT_IGNORE_FILE_NAME);
    const originalContent = '.custom\n';
    await writeFile(gitignorePath, originalContent);

    // Act
    await persistenceService.saveCollection(newCollection, true);

    // Assert
    const content = await readFile(gitignorePath, 'utf-8');
    expect(content).toBe(originalContent);
  });

  it('saveCollection(recursive=false) should not modify .gitignore', async () => {
    // Arrange
    const newCollection = getExampleCollection();
    await mkdir(newCollection.dirPath, { recursive: true });
    const gitignorePath = path.join(newCollection.dirPath, GIT_IGNORE_FILE_NAME);

    // Act
    await persistenceService.saveCollection(newCollection, false);

    // Assert
    expect(await exists(gitignorePath)).toBe(false);
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

    await persistenceService.saveCollection(collection, true);

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
    const folderInfoFilePath = path.join(
      collection.dirPath,
      folder.title,
      persistenceService.getInfoFileName(folder.type)
    );

    await persistenceService.saveCollection(collection, true);
    await rm(folderInfoFilePath);

    // Assert
    expect(await exists(folderInfoFilePath)).toBe(false);

    // Act
    await persistenceService.saveFolder(folder);

    // Assert
    expect(await exists(folderInfoFilePath)).toBe(true);
  });

  it('copyFolder() should copy the folder and its children recursively', async () => {
    // Arrange
    const folder = getExampleFolderWithChildren(collection.id);
    const copiedFolderTitle = `${folder.title}-copy`;
    collection.children.push(folder);

    const folderInfoFilePath = path.join(
      collection.dirPath,
      copiedFolderTitle,
      persistenceService.getInfoFileName(folder.type)
    );
    const childRequestFilePath = path.join(
      collection.dirPath,
      copiedFolderTitle,
      folder.children[1].title,
      persistenceService.getInfoFileName('request')
    );
    const childFolderInfoFilePath = path.join(
      collection.dirPath,
      copiedFolderTitle,
      folder.children[0].title,
      persistenceService.getInfoFileName('folder')
    );
    const childFolderRequestInfoFilePath = path.join(
      collection.dirPath,
      copiedFolderTitle,
      folder.children[0].title,
      (folder.children[0] as Folder).children[0].title,
      persistenceService.getInfoFileName('request')
    );

    await persistenceService.saveCollection(collection, true);

    // Assert
    expect(await exists(folderInfoFilePath)).toBe(false);
    expect(await exists(childRequestFilePath)).toBe(false);
    expect(await exists(childFolderInfoFilePath)).toBe(false);
    expect(await exists(childFolderRequestInfoFilePath)).toBe(false);

    // Act
    const copiedFolder = await persistenceService.copyFolder(folder);

    // Assert
    expect(copiedFolder.title).toBe(`${folder.title} (Copy)`);
    expect(copiedFolder.id).not.toBe(folder.id);
    expect(copiedFolder.parentId).toBe(collection.id);

    expect(await exists(folderInfoFilePath)).toBe(true);
    expect(await exists(childRequestFilePath)).toBe(true);
    expect(await exists(childFolderInfoFilePath)).toBe(true);
    expect(await exists(childFolderRequestInfoFilePath)).toBe(true);
  });

  it('copyRequest() should copy the request and its text body', async () => {
    // Arrange
    const textBody = 'example request body';
    const request = getExampleRequest(collection.id);
    const copiedRequestTitle = `${request.title}-copy`;

    collection.children.push(request);

    const requestInfoFilePath = path.join(
      collection.dirPath,
      request.title,
      persistenceService.getInfoFileName(request.type)
    );
    const copiedRequestInfoFilePath = path.join(
      collection.dirPath,
      copiedRequestTitle,
      persistenceService.getInfoFileName(request.type)
    );
    const requestTextBodyFilePath = path.join(
      collection.dirPath,
      request.title,
      TEXT_BODY_FILE_NAME
    );
    const copiedRequestTextBodyFilePath = path.join(
      collection.dirPath,
      copiedRequestTitle,
      TEXT_BODY_FILE_NAME
    );

    await persistenceService.saveCollection(collection, true);
    await persistenceService.saveRequest(request, textBody);

    // Assert
    expect(await exists(requestInfoFilePath)).toBe(true);
    expect(await exists(requestTextBodyFilePath)).toBe(true);
    expect(await exists(copiedRequestInfoFilePath)).toBe(false);
    expect(await exists(copiedRequestTextBodyFilePath)).toBe(false);

    // Act
    const copiedRequest = await persistenceService.copyRequest(request);

    // Assert
    expect(copiedRequest.title).toBe(`${request.title} (Copy)`);
    expect(copiedRequest.id).not.toBe(request.id);
    expect(copiedRequest.parentId).toBe(collection.id);
    expect(copiedRequest.draft).toBe(false);

    expect(await exists(copiedRequestInfoFilePath)).toBe(true);
    expect(await exists(copiedRequestTextBodyFilePath)).toBe(true);

    // Verify the text body content is the same
    const originalTextBodyStream = await persistenceService.loadTextBodyOfRequest(request);
    const copiedTextBodyStream = await persistenceService.loadTextBodyOfRequest(copiedRequest);
    expect(await streamToString(originalTextBodyStream)).toBe(textBody);
    expect(await streamToString(copiedTextBodyStream)).toBe(textBody);
  });

  it('saveCollection() with recursive flag should save the collection and its children', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);
    const request = getExampleRequest(folder.id);
    folder.children.push(request);

    // Act
    await persistenceService.saveCollection(collection, true);

    // Assert
    expect(
      await exists(
        path.join(collection.dirPath, persistenceService.getInfoFileName(collection.type))
      )
    ).toBe(true);
    expect(
      await exists(
        path.join(collection.dirPath, folder.title, persistenceService.getInfoFileName(folder.type))
      )
    ).toBe(true);
    expect(
      await exists(
        path.join(
          collection.dirPath,
          folder.title,
          request.title,
          persistenceService.getInfoFileName(request.type)
        )
      )
    ).toBe(true);
  });

  it('saveChanges() should overwrite the request metadata with its draft metadata', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);

    await persistenceService.saveCollection(collection, true);

    request.draft = true;
    request.method = RequestMethod.POST;

    await persistenceService.saveRequest(request);
    let originalInfo = JSON.parse(
      await readFile(
        path.join(
          collection.dirPath,
          request.title,
          persistenceService.getInfoFileName(request.type)
        ),
        'utf-8'
      )
    ) as RequestInfoFile;
    const draftInfo = JSON.parse(
      await readFile(
        path.join(
          collection.dirPath,
          request.title,
          DRAFT_DIR_NAME,
          persistenceService.getInfoFileName(request.type)
        ),
        'utf-8'
      )
    ) as RequestInfoFile;

    // Assert
    expect(
      await exists(
        path.join(
          collection.dirPath,
          request.title,
          persistenceService.getInfoFileName(request.type)
        )
      )
    ).toBe(true);
    expect(
      await exists(
        path.join(
          collection.dirPath,
          request.title,
          persistenceService.getInfoFileName(request.type)
        )
      )
    ).toBe(true);
    expect(originalInfo).not.toEqual(draftInfo);

    // Act
    await persistenceService.saveChanges(request);

    // Assert
    expect(
      await exists(
        path.join(
          collection.dirPath,
          request.title,
          persistenceService.getInfoFileName(request.type)
        )
      )
    ).toBe(true);
    expect(
      await exists(
        path.join(
          collection.dirPath,
          request.title,
          DRAFT_DIR_NAME,
          persistenceService.getInfoFileName(request.type)
        )
      )
    ).toBe(false);
    originalInfo = JSON.parse(
      await readFile(
        path.join(
          collection.dirPath,
          request.title,
          persistenceService.getInfoFileName(request.type)
        ),
        'utf-8'
      )
    ) as RequestInfoFile;
    expect(originalInfo).toEqual(draftInfo);
  });

  it('discardChanges() should delete the draft metadata and keep the original', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);

    await persistenceService.saveCollection(collection, true);

    request.draft = true;
    request.method = RequestMethod.POST;

    await persistenceService.saveRequest(request);
    const oldInfo = JSON.parse(
      await readFile(
        path.join(
          collection.dirPath,
          request.title,
          persistenceService.getInfoFileName(request.type)
        ),
        'utf-8'
      )
    ) as RequestInfoFile;

    // Assert
    expect(
      await exists(
        path.join(
          collection.dirPath,
          request.title,
          persistenceService.getInfoFileName(request.type)
        )
      )
    ).toBe(true);
    expect(
      await exists(
        path.join(
          collection.dirPath,
          request.title,
          persistenceService.getInfoFileName(request.type)
        )
      )
    ).toBe(true);

    // Act
    await persistenceService.discardChanges(request);

    // Assert
    expect(
      await exists(
        path.join(
          collection.dirPath,
          request.title,
          persistenceService.getInfoFileName(request.type)
        )
      )
    ).toBe(true);
    expect(
      await exists(
        path.join(
          collection.dirPath,
          request.title,
          DRAFT_DIR_NAME,
          persistenceService.getInfoFileName(request.type)
        )
      )
    ).toBe(false);
    const newInfo = JSON.parse(
      await readFile(
        path.join(
          collection.dirPath,
          request.title,
          persistenceService.getInfoFileName(request.type)
        ),
        'utf-8'
      )
    ) as RequestInfoFile;
    expect(oldInfo).toEqual(newInfo);
  });

  it('delete() should delete the directory of a trufos object', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);

    await persistenceService.saveCollection(collection, true);

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

    await persistenceService.saveCollection(collection, true);
    await persistenceService.saveRequest(request, textBody);

    // Assert
    expect(await exists(path.join(collection.dirPath, request.title, TEXT_BODY_FILE_NAME))).toBe(
      true
    );
    expect(
      await exists(
        path.join(collection.dirPath, request.title, DRAFT_DIR_NAME, TEXT_BODY_FILE_NAME)
      )
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

    await persistenceService.saveCollection(collection, true);
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

    await persistenceService.saveCollection(collection, true);
    await persistenceService.saveRequest(request, textBody);

    // Assert
    expect(await exists(path.join(collection.dirPath, request.title, TEXT_BODY_FILE_NAME))).toBe(
      false
    );
    expect(await exists(path.join(collection.dirPath, request.title))).toBe(true);

    // Act
    const result = await persistenceService.loadTextBodyOfRequest(request);

    // Assert
    expect(await streamToString(result)).toBe(textBody);
  });

  it('loadCollection() should load the collection and its children at the given directory', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);

    await persistenceService.saveCollection(collection, true);
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

  it('loadCollection() without recursive flag should load the collection without children', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);

    await persistenceService.saveCollection(collection, true);

    // Act
    const result = await persistenceService.loadCollection(collection.dirPath, false);

    // Assert
    expect(result).toEqual(Object.assign(collection, { children: [] }));
  });

  it('loadCollection() should merge ~secrets.json.bin with collection.json', async () => {
    const collection = getExampleCollection();
    const secretVariable: VariableObject = { value: '123', secret: true };
    const plainVariable: VariableObject = { value: '321' };
    const variables: VariableMap = { secret: secretVariable, plain: plainVariable };
    collection.variables = structuredClone(variables);
    collection.environments.dev = { variables: structuredClone(variables) };
    await persistenceService.saveCollection(collection);

    // Act
    const result = await persistenceService.loadCollection(collection.dirPath, false);

    // Assert
    expect(result.variables).toEqual(variables);
    expect(result.environments.dev.variables).toEqual(variables);
    expect(
      JSON.parse(
        await readFile(
          path.join(collection.dirPath, persistenceService.getInfoFileName(collection.type)),
          'utf-8'
        )
      )
    ).not.toContain(secretVariable);
    expect(
      JSON.parse(await readFile(path.join(collection.dirPath, SECRETS_FILE_NAME), 'utf-8'))
    ).not.toContain(plainVariable);
  });

  it('loadCollection() should order direct children by their index (undefined last)', async () => {
    // Arrange
    const folder1 = getExampleFolder(collection.id);
    folder1.title = 'Folder1';
    folder1.index = 2;
    const folder2 = getExampleFolder(collection.id);
    folder2.title = 'Folder2';
    folder2.index = 1;
    const request1 = getExampleRequest(collection.id);
    request1.title = 'Req1';
    request1.index = 5;
    const request2 = getExampleRequest(collection.id);
    request2.title = 'Req2'; // no index -> should be last
    collection.children.push(folder1, folder2, request2, request1);
    await persistenceService.saveCollection(collection, true);

    // Act
    const loaded = await persistenceService.loadCollection(collection.dirPath);

    // Assert
    const titles = loaded.children.map((c) => c.title);
    expect(titles).toEqual(['Folder2', 'Folder1', 'Req1', 'Req2']);
    expect(loaded.children[0].index).toBe(1);
    expect(loaded.children[1].index).toBe(2);
    expect(loaded.children[2].index).toBe(5);
    expect(loaded.children[3].index).toBeUndefined();
  });

  it('loadCollection() should order nested children inside folders by index (undefined last)', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    folder.title = 'RootFolder';
    const childA = getExampleRequest(folder.id);
    childA.title = 'A';
    childA.index = 10;
    const childB = getExampleRequest(folder.id);
    childB.title = 'B';
    childB.index = 1;
    const childC = getExampleRequest(folder.id);
    childC.title = 'C'; // no index
    folder.children.push(childA, childB, childC);
    collection.children.push(folder);
    await persistenceService.saveCollection(collection, true);

    // Act
    const loaded = await persistenceService.loadCollection(collection.dirPath);
    const loadedFolder = loaded.children.find((c) => c.title === 'RootFolder') as Folder;

    // Assert
    const nestedTitles = loadedFolder.children.map((c) => c.title);
    expect(nestedTitles).toEqual(['B', 'A', 'C']);
    expect((loadedFolder.children[0] as any).index).toBe(1);
    expect((loadedFolder.children[1] as any).index).toBe(10);
    expect((loadedFolder.children[2] as any).index).toBeUndefined();
  });
});

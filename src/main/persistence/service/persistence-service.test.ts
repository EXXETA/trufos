import { exists, USER_DATA_DIR } from 'main/util/fs-util';
import { text } from 'node:stream/consumers';
import { randomUUID } from 'node:crypto';
import fs, { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TEXT_BODY_FILE_NAME, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { VariableMap, VariableObject } from 'shim/objects/variables';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freeze } from 'immer';
import { generateDefaultCollection } from './default-collection';
import { sanitizeTitle } from 'shim/string';
import { CollectionInfoFile, RequestInfoFile } from './info-files/latest';
import { GIT_IGNORE_FILE_NAME } from './git-ignore';
import { PersistenceService } from './persistence-service';
import {
  DRAFT_DIR_NAME,
  getInfoFileName,
  getScriptFileName,
  ORDER_FILE_NAME,
  SECRETS_FILE_NAME,
} from 'main/persistence/constants';
import { ScriptType } from 'shim/scripting';
import { AuthorizationType } from 'shim/objects/auth';

const persistenceService = PersistenceService.instance;

const collectionDirPath = path.join(USER_DATA_DIR, 'default-collection');
const FIXED_MTIME_MS = 1700000000000;

function getExampleCollection(): Collection {
  return {
    id: randomUUID(),
    type: 'collection',
    lastModified: Date.now(),
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
    lastModified: Date.now(),
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
    lastModified: Date.now(),
    title: 'request',
    draft: false,
    parentId,
    method: RequestMethod.GET,
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
  };
}

async function streamToString(stream: Readable) {
  return await text(stream);
}

describe('PersistenceService', () => {
  let collection: Collection;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_MTIME_MS);
    collection = getExampleCollection();
    await mkdir(collection.dirPath, { recursive: true });
    const originalStat = fs.stat.bind(fs);
    vi.spyOn(fs, 'stat').mockImplementation(async (...args: Parameters<typeof fs.stat>) => {
      const stats = await originalStat(...args);
      return { ...stats, mtimeMs: FIXED_MTIME_MS } as Awaited<ReturnType<typeof fs.stat>>;
    });
  });

  it('createDefaultCollectionIfNotExists() should not create if it already exists', async () => {
    // Arrange
    const defaultCollectionImport = await import('./default-collection.js');
    const generateDefaultCollectionSpy = vi.spyOn(
      defaultCollectionImport,
      'generateDefaultCollection'
    );
    await mkdir(collectionDirPath);
    await writeFile(path.join(collectionDirPath, getInfoFileName(collection.type)), '');

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

  it('rename() should rename the directory of a folder', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);
    const oldDirPath = path.join(collection.dirPath, folder.title);

    await persistenceService.saveCollection(collection, true);

    // Assert
    expect(await exists(oldDirPath)).toBe(true);

    // Act
    const title = randomUUID();
    await persistenceService.rename(freeze({ ...folder, title }, true));

    // Assert
    const newDirPath = path.join(collection.dirPath, title);
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
    await persistenceService.rename({ ...folder, title: newTitle });

    // Assert: directory moved
    expect(await exists(expectedNewPath)).toBe(true);
    expect(await exists(oldChildDirPath)).toBe(false);

    // Assert: child folder new path exists
    const newChildFolderPath = path.join(expectedNewPath, getInfoFileName('folder'));
    expect(await exists(newChildFolderPath)).toBe(true);

    // Info file title updated
    const info = JSON.parse(
      await readFile(path.join(expectedNewPath, getInfoFileName('folder')), 'utf-8')
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
    await persistenceService.rename({ ...request, title: 'Same $Title$' }); // sanitized collides -> no dir rename, only title change

    // Assert: file still exists
    expect(await exists(requestDirPath)).toBe(true);
    const info = JSON.parse(
      await readFile(path.join(requestDirPath, getInfoFileName('request')), 'utf-8')
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
    const expectedDirPath = path.join(collection.dirPath, `${sanitizeTitle('FolderB')}-2`);

    // Act
    await persistenceService.rename({ ...folderA, title: 'FolderB' });

    // Assert
    expect(await exists(expectedDirPath)).toBe(true);
  });

  it('saveCollection() should save the metadata of the collection', async () => {
    // Act
    await persistenceService.saveCollection(collection);

    // Assert
    expect(await exists(path.join(collection.dirPath, getInfoFileName(collection.type)))).toBe(
      true
    );
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
      await readFile(path.join(collection.dirPath, getInfoFileName(collection.type)), 'utf-8')
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

  it('saveCollection(recursive=true) should write the inline body of an imported request to its body file', async () => {
    // Arrange: importers deliver the body inline, because they never touch the file system
    const text = '{\n  "name": ""\n}';
    const request = getExampleRequest(collection.id);
    request.body = { type: RequestBodyType.TEXT, mimeType: 'application/json', text };
    collection.children.push(request);

    // Act
    await persistenceService.saveCollection(collection, true);

    // Assert: the body file is the canonical form, so the info file must not repeat the text
    const dirPath = path.join(collection.dirPath, request.title);
    expect(await readFile(path.join(dirPath, TEXT_BODY_FILE_NAME), 'utf-8')).toBe(text);
    const info = JSON.parse(
      await readFile(path.join(dirPath, getInfoFileName('request')), 'utf-8')
    ) as RequestInfoFile;
    expect(info.body).toEqual({ type: RequestBodyType.TEXT, mimeType: 'application/json' });

    // Assert: the request is readable again, which is what the editor and the sending both use
    const stream = await persistenceService.loadTextBodyOfRequest(request);
    expect(stream).toBeDefined();
    expect(await streamToString(stream!)).toBe(text);
  });

  it('saveCollection(recursive=true) should keep the inline text of form data fields', async () => {
    // Arrange: form data has no body file, so its field texts must stay in the info file
    const request = getExampleRequest(collection.id);
    request.body = {
      type: RequestBodyType.FORM_DATA,
      fields: [
        {
          key: 'name',
          isActive: true,
          value: { type: RequestBodyType.TEXT, mimeType: 'text/plain', text: 'Milo' },
        },
      ],
    };
    collection.children.push(request);

    // Act
    await persistenceService.saveCollection(collection, true);

    // Assert
    const info = JSON.parse(
      await readFile(
        path.join(collection.dirPath, request.title, getInfoFileName('request')),
        'utf-8'
      )
    ) as RequestInfoFile;
    expect(info.body).toEqual(request.body);
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

  it('saveCollection(recursive=true) should add missing lines to an existing .gitignore', async () => {
    // Arrange
    const newCollection = getExampleCollection();
    await mkdir(newCollection.dirPath, { recursive: true });
    const gitignorePath = path.join(newCollection.dirPath, GIT_IGNORE_FILE_NAME);
    await writeFile(gitignorePath, '.custom\n.draft\n');

    // Act
    await persistenceService.saveCollection(newCollection, true);

    // Assert
    const content = await readFile(gitignorePath, 'utf-8');
    expect(content).toBe('.custom\n.draft\n.secrets.bin\n.*.tmp');
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

  it('saveFolder() should save the metadata of the folder', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);
    const folderInfoFilePath = path.join(
      collection.dirPath,
      folder.title,
      getInfoFileName(folder.type)
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

  it('saveCollection() with recursive flag should save the collection and its children', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);
    const request = getExampleRequest(folder.id);
    folder.children.push(request);

    // Act
    await persistenceService.saveCollection(collection, true);

    // Assert
    expect(await exists(path.join(collection.dirPath, getInfoFileName(collection.type)))).toBe(
      true
    );
    expect(
      await exists(path.join(collection.dirPath, folder.title, getInfoFileName(folder.type)))
    ).toBe(true);
    expect(
      await exists(
        path.join(collection.dirPath, folder.title, request.title, getInfoFileName(request.type))
      )
    ).toBe(true);
  });

  it('createCollection() should reject a directory that is not empty', async () => {
    // Arrange
    await writeFile(path.join(collection.dirPath, 'unrelated.txt'), 'content');

    // Act & Assert
    await expect(
      persistenceService.createCollection(collection.dirPath, 'collection')
    ).rejects.toThrow('Directory is not empty');
  });

  it('createCollection() should create a collection in a directory that does not exist yet', async () => {
    // Arrange
    const dirPath = path.join(collection.dirPath, 'new-collection');

    // Act
    const created = await persistenceService.createCollection(dirPath, 'collection');

    // Assert
    expect(created.dirPath).toBe(dirPath);
    expect(await exists(path.join(dirPath, getInfoFileName('collection')))).toBe(true);
  });

  it('loadTextBodyOfRequest() should load the text body of a request', async () => {
    // Arrange
    const textBody = 'text body';
    const request = getExampleRequest(collection.id);
    collection.children.push(request);

    await persistenceService.saveCollection(collection, true);
    await persistenceService.saveRequestInfo(request);
    await persistenceService.writeTextBody(request, textBody);

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
    // @ts-expect-error streamToString argument may not match expected type
    expect(await streamToString(result)).toBe(textBody);
  });

  it('loadTextBodyOfRequest() should fail for a request without a directory instead of reserving one', async () => {
    // Arrange
    await persistenceService.saveCollection(collection);
    const unsaved = getExampleRequest(collection.id);
    const saved = getExampleRequest(collection.id);

    // Act & Assert
    await expect(persistenceService.loadTextBodyOfRequest(unsaved)).rejects.toThrow('not found');

    // the directory of the unsaved request was not reserved, so the saved one gets its name
    await persistenceService.saveRequestInfo(saved);
    expect(await exists(path.join(collection.dirPath, saved.title))).toBe(true);
  });

  it('loadTextBodyOfRequest() should load a part of the text body, getTextBodySize() its size', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await persistenceService.saveRequestInfo(request);
    await persistenceService.writeTextBody(request, '0123456789');

    // Act
    const part = await persistenceService.loadTextBodyOfRequest(request, 'utf8', {
      start: 2,
      end: 5,
    });

    // Assert
    expect(await streamToString(part!)).toBe('2345');
    expect(await persistenceService.getTextBodySize(request)).toBe(10);
  });

  it('getTextBodySize() should be 0 without a text body file', async () => {
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await persistenceService.saveRequestInfo(request);

    expect(await persistenceService.getTextBodySize(request)).toBe(0);
  });

  it('loadTextBodyOfRequest() should load the text body of a request with utf8', async () => {
    // Arrange
    const textBody = 'text body';
    const request = getExampleRequest(collection.id);
    collection.children.push(request);

    await persistenceService.saveCollection(collection, true);
    await persistenceService.saveRequestInfo(request);
    await persistenceService.writeTextBody(request, textBody);

    // Act
    const result =
      // @ts-expect-error loadTextBodyOfRequest returns ReadStream | undefined; undefined case won't occur here
      (await Array.fromAsync(await persistenceService.loadTextBodyOfRequest(request, 'utf8'))).join(
        ''
      );

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
    await persistenceService.saveRequestInfo(request);
    await persistenceService.writeTextBody(request, textBody);

    // Assert
    expect(await exists(path.join(collection.dirPath, request.title, TEXT_BODY_FILE_NAME))).toBe(
      false
    );
    expect(await exists(path.join(collection.dirPath, request.title))).toBe(true);

    // Act
    const result = await persistenceService.loadTextBodyOfRequest(request);

    // Assert
    // @ts-expect-error streamToString argument may not match expected type
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

    expect(result.children[0].lastModified).toBe(FIXED_MTIME_MS);
    expect(result.lastModified).toBe(FIXED_MTIME_MS);
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
    expect(result.lastModified).toBe(FIXED_MTIME_MS);
    expect(result).toEqual({ ...collection, children: [] });
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
        await readFile(path.join(collection.dirPath, getInfoFileName(collection.type)), 'utf-8')
      )
    ).not.toContain(secretVariable);
    expect(
      JSON.parse(await readFile(path.join(collection.dirPath, SECRETS_FILE_NAME), 'utf-8'))
    ).not.toContain(plainVariable);
  });

  it('loadCollection() should preserve order from order.json', async () => {
    // Arrange
    const folder1 = getExampleFolder(collection.id);
    folder1.title = 'Folder1';
    const folder2 = getExampleFolder(collection.id);
    folder2.title = 'Folder2';
    const request1 = getExampleRequest(collection.id);
    request1.title = 'Req1';
    const request2 = getExampleRequest(collection.id);
    request2.title = 'Req2';
    collection.children.push(folder1, folder2, request1, request2);
    await persistenceService.saveCollection(collection, true);

    // Reorder so folder2 comes first
    await persistenceService.saveOrder(collection.id, [
      folder2.id,
      folder1.id,
      request1.id,
      request2.id,
    ]);

    // Act
    const loaded = await persistenceService.loadCollection(collection.dirPath);

    // Assert - folder2 should be first
    expect(loaded.children[0].title).toBe('Folder2');
  });

  it('loadCollection() should keep the directory order when children finish loading out of order', async () => {
    // Arrange - more children than may be read concurrently, so that reads are queued
    const childCount = 12;
    for (let i = 0; i < childCount; i++) {
      const request = getExampleRequest(collection.id);
      request.title = `req-${String(i).padStart(2, '0')}`;
      collection.children.push(request);
    }
    await persistenceService.saveCollection(collection, true);

    // let the earlier children finish last, so that collecting them by completion instead of by
    // position would return them in the wrong order
    const originalReadFile = fs.readFile.bind(fs);
    vi.spyOn(fs, 'readFile').mockImplementation(async (...args: Parameters<typeof fs.readFile>) => {
      const content = await originalReadFile(...args);
      const index = /req-(\d+)/.exec(String(args[0]))?.[1];
      if (index != null) {
        await new Promise((resolve) => setTimeout(resolve, childCount - Number(index)));
      }
      return content;
    });

    // Act
    const loaded = await persistenceService.loadCollection(collection.dirPath);

    // Assert
    expect(loaded.children.map((child) => child.title)).toEqual(
      collection.children.map((child) => child.title)
    );
  });

  it('loadCollection() should preserve order.json of nested folders', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    const requests = ['a', 'b', 'c'].map((title) => {
      const request = getExampleRequest(folder.id);
      request.title = title;
      return request;
    });
    folder.children.push(...requests);
    collection.children.push(folder);
    await persistenceService.saveCollection(collection, true);

    // move the last request to the front
    await persistenceService.saveOrder(folder.id, [requests[2].id, requests[0].id, requests[1].id]);

    // Act
    const loaded = await persistenceService.loadCollection(collection.dirPath);

    // Assert
    const loadedFolder = loaded.children[0];
    if (loadedFolder.type !== 'folder') throw new Error('expected a folder');
    expect(loadedFolder.children.map((child) => child.title)).toEqual(['c', 'a', 'b']);
  });

  it('loadCollection() should fail if the info file of a child is corrupt', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    request.title = 'broken';
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await writeFile(
      path.join(collection.dirPath, sanitizeTitle(request.title), getInfoFileName(request.type)),
      '{ this is not json'
    );

    // Act & Assert
    await expect(persistenceService.loadCollection(collection.dirPath)).rejects.toThrow(
      'Failed to load request info file'
    );
  });

  it('loadCollection() should fail if a request info file is missing request fields', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    request.title = 'incomplete';
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    const infoFilePath = path.join(
      collection.dirPath,
      sanitizeTitle(request.title),
      getInfoFileName(request.type)
    );
    const { url: _url, ...incomplete } = JSON.parse(await readFile(infoFilePath, 'utf8'));
    await writeFile(infoFilePath, JSON.stringify(incomplete));

    // Act & Assert
    await expect(persistenceService.loadCollection(collection.dirPath)).rejects.toThrow(
      'Failed to load request info file'
    );
  });

  it('loadCollection() should strip unknown properties from info files', async () => {
    // Arrange
    const infoFilePath = path.join(collection.dirPath, getInfoFileName(collection.type));
    await persistenceService.saveCollection(collection);
    const info = JSON.parse(await readFile(infoFilePath, 'utf8'));
    await writeFile(infoFilePath, JSON.stringify({ ...info, unknownProperty: true }));

    // Act
    const loaded = await persistenceService.loadCollection(collection.dirPath);

    // Assert
    expect(loaded).not.toHaveProperty('unknownProperty');
  });

  it('move() should move the directory and keep the paths of all descendants', async () => {
    // Arrange
    const target = getExampleFolder(collection.id);
    target.title = 'Target';
    const folder = getExampleFolderWithChildren(collection.id);
    collection.children.push(target, folder);
    await persistenceService.saveCollection(collection, true);
    const grandChild = (folder.children[0] as Folder).children[0] as TrufosRequest;

    // Act
    await persistenceService.move(folder.id, target.id);

    // Assert
    const movedDirPath = path.join(collection.dirPath, 'target', folder.title);
    expect(await exists(path.join(collection.dirPath, folder.title))).toBe(false);
    expect(await exists(movedDirPath)).toBe(true);

    // Assert: a descendant is still written to its new directory
    await persistenceService.writeTextBody(freeze(grandChild, true), 'moved');
    expect(
      await readFile(
        path.join(movedDirPath, folder.children[0].title, grandChild.title, TEXT_BODY_FILE_NAME),
        'utf-8'
      )
    ).toBe('moved');
  });

  it('move() should not move onto a sibling directory with the same name', async () => {
    // Arrange: the folder already holds a request whose directory name the moved request would get
    const folder = getExampleFolder(collection.id);
    const request = getExampleRequest(collection.id);
    const sibling = getExampleRequest(folder.id);
    collection.children.push(folder, request);
    folder.children.push(sibling);
    await persistenceService.saveCollection(collection, true);

    // Act
    await persistenceService.move(request.id, folder.id);

    // Assert: both requests exist side by side, the moved one with a suffixed directory name
    const folderDirPath = path.join(collection.dirPath, folder.title);
    expect(await exists(path.join(folderDirPath, sibling.title))).toBe(true);
    expect(await exists(path.join(folderDirPath, `${request.title}-2`))).toBe(true);

    // Assert: the request stays saveable at its new location
    await persistenceService.saveRequestInfo(request);
    expect(
      await exists(path.join(folderDirPath, `${request.title}-2`, getInfoFileName('request')))
    ).toBe(true);
  });

  it('move() should not move onto a directory that exists but belongs to no known object', async () => {
    // Arrange: a leftover directory with the name the moved request would get
    const folder = getExampleFolder(collection.id);
    const request = getExampleRequest(collection.id);
    collection.children.push(folder, request);
    await persistenceService.saveCollection(collection, true);
    const folderDirPath = path.join(collection.dirPath, folder.title);
    await mkdir(path.join(folderDirPath, request.title, 'leftover'), { recursive: true });

    // Act
    await persistenceService.move(request.id, folder.id);

    // Assert
    expect(await exists(path.join(folderDirPath, request.title, 'leftover'))).toBe(true);
    expect(await exists(path.join(folderDirPath, `${request.title}-2`))).toBe(true);
  });

  it('rename() should not rename onto a directory that exists but belongs to no known object', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    folder.title = 'FolderA';
    collection.children.push(folder);
    await persistenceService.saveCollection(collection, true);
    const takenDirPath = path.join(collection.dirPath, sanitizeTitle('FolderB'));
    await mkdir(path.join(takenDirPath, 'leftover'), { recursive: true });

    // Act
    await persistenceService.rename({ ...folder, title: 'FolderB' });

    // Assert
    expect(await exists(path.join(takenDirPath, 'leftover'))).toBe(true);
    expect(await exists(`${takenDirPath}-2`)).toBe(true);
  });

  it('saveRequestInfo() should not write a new request into a directory that belongs to no known object', async () => {
    // Arrange
    await persistenceService.saveCollection(collection, true);
    const request = getExampleRequest(collection.id);
    await mkdir(path.join(collection.dirPath, request.title, 'leftover'), { recursive: true });

    // Act
    await persistenceService.saveRequestInfo(request);

    // Assert
    expect(await exists(path.join(collection.dirPath, request.title, 'leftover'))).toBe(true);
    expect(
      await exists(path.join(collection.dirPath, `${request.title}-2`, getInfoFileName('request')))
    ).toBe(true);
  });

  it('loadCollectionBase() should read the collection without registering its directory', async () => {
    // Arrange: a copy of the collection with the same ID
    await persistenceService.saveCollection(collection, true);
    const copyDirPath = path.join(USER_DATA_DIR, 'collections', `${randomUUID()}-copy`);
    await fs.cp(collection.dirPath, copyDirPath, { recursive: true });

    // Act
    const result = await persistenceService.loadCollectionBase(copyDirPath);
    await persistenceService.saveCollectionInfo({ ...collection, title: 'changed' });

    // Assert
    expect(result).toEqual({ id: collection.id, title: collection.title, dirPath: copyDirPath });
    const info = JSON.parse(await readFile(path.join(copyDirPath, 'collection.json'), 'utf-8'));
    expect(info.title).toBe(collection.title);
  });

  it('move() and saveOrder() should keep both parents complete after reload (#957)', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    folder.title = 'Folder';
    const request1 = getExampleRequest(folder.id);
    request1.title = 'Req1';
    const request2 = getExampleRequest(folder.id);
    request2.title = 'Req2';
    folder.children.push(request1, request2);
    const request3 = getExampleRequest(collection.id);
    request3.title = 'Req3';
    const request4 = getExampleRequest(collection.id);
    request4.title = 'Req4';
    collection.children.push(folder, request3, request4);
    await persistenceService.saveCollection(collection, true);

    // Act - move Req3 from the collection into the folder between Req1 and Req2
    await persistenceService.move(request3.id, folder.id);
    await persistenceService.saveOrder(collection.id, [folder.id, request4.id]);
    await persistenceService.saveOrder(folder.id, [request1.id, request3.id, request2.id]);

    // Assert
    const loaded = await persistenceService.loadCollection(collection.dirPath);
    expect(loaded.children.map((c) => c.title)).toEqual(['Folder', 'Req4']);
    const loadedFolder = loaded.children.find((c) => c.title === 'Folder') as Folder;
    expect(loadedFolder.children.map((c) => c.title)).toEqual(['Req1', 'Req3', 'Req2']);
  });

  it('saveOrder() should write the given child IDs to order.json', async () => {
    // Arrange
    const folder = getExampleFolder(collection.id);
    collection.children.push(folder);
    await persistenceService.saveCollection(collection, true);

    // Act
    await persistenceService.saveOrder(folder.id, ['b', 'a']);

    // Assert
    const order = JSON.parse(
      await readFile(path.join(collection.dirPath, folder.title, ORDER_FILE_NAME), 'utf-8')
    );
    expect(order).toEqual(['b', 'a']);
  });

  it('rename() should keep the draft changes of a request out of its saved state', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    const draft: TrufosRequest = {
      ...request,
      draft: true,
      url: { base: 'https://draft.example.com', query: [] },
    };
    await persistenceService.createDraft(draft);

    // Act
    await persistenceService.rename(
      freeze({ ...draft, title: 'renamed' }, true),
      freeze({ ...request, title: 'renamed' }, true)
    );

    // Assert
    const requestDirPath = path.join(collection.dirPath, sanitizeTitle('renamed'));
    const infoFileName = getInfoFileName('request');
    const saved = JSON.parse(await readFile(path.join(requestDirPath, infoFileName), 'utf-8'));
    const drafted = JSON.parse(
      await readFile(path.join(requestDirPath, DRAFT_DIR_NAME, infoFileName), 'utf-8')
    );
    expect(saved.title).toBe('renamed');
    expect(saved.url.base).toBe(request.url.base);
    expect(drafted.title).toBe('renamed');
    expect(drafted.url.base).toBe('https://draft.example.com');
  });

  it('rename() should keep the directory if only the suffix of a taken name would change', async () => {
    // Arrange: "folder-2" exists because "folder" was taken
    const first = getExampleFolder(collection.id);
    const second = getExampleFolder(collection.id);
    collection.children.push(first, second);
    await persistenceService.saveCollection(collection, true);
    const secondDirPath = path.join(collection.dirPath, 'folder-2');
    expect(await exists(secondDirPath)).toBe(true);

    // Act
    await persistenceService.rename({ ...second, title: 'Folder' });

    // Assert
    expect(await exists(secondDirPath)).toBe(true);
    expect(await exists(path.join(collection.dirPath, 'folder-3'))).toBe(false);
  });

  it('writeTextBody() should not change the body a request that is being sent streams', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await persistenceService.writeTextBody(request, 'sent');
    const stream = await persistenceService.loadTextBodyOfRequest(request, 'utf8');

    // Act
    await persistenceService.writeTextBody(request, 'edited');

    // Assert
    const dirPath = path.join(collection.dirPath, request.title);
    expect(await text(stream!)).toBe('sent');
    expect(await readFile(path.join(dirPath, TEXT_BODY_FILE_NAME), 'utf-8')).toBe('edited');
    expect((await fs.readdir(dirPath)).filter((file) => file.endsWith('.tmp'))).toEqual([]);
  });

  it('openRequestFiles() should read the scripts and open the text body of a draft', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    const draft = freeze({ ...request, draft: true }, true);
    await persistenceService.createDraft(draft);
    await persistenceService.writeTextBody(draft, 'draft body');
    await persistenceService.saveScript(draft, ScriptType.POST_RESPONSE, 'post');

    // Act
    const files = await persistenceService.openRequestFiles(draft);
    await persistenceService.writeTextBody(draft, 'edited body');

    // Assert
    expect(files.scripts).toEqual({ [ScriptType.POST_RESPONSE]: 'post' });
    expect(await text(files.textBody!)).toBe('draft body');
  });

  it('openRequestFiles() should have no text body for a request with another body type', async () => {
    // Arrange
    const request: TrufosRequest = {
      ...getExampleRequest(collection.id),
      body: { type: RequestBodyType.FILE, filePath: '/file.bin' },
    };
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);

    // Act
    const files = await persistenceService.openRequestFiles(request);

    // Assert
    expect(files).toEqual({ scripts: {}, textBody: undefined });
  });

  it('openRequestFiles() should not open the text body if reading a script fails', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await persistenceService.writeTextBody(request, 'body');
    vi.spyOn(persistenceService, 'loadScript').mockRejectedValueOnce(new Error('read failed'));
    const loadTextBody = vi.spyOn(persistenceService, 'loadTextBodyOfRequest');

    // Act & Assert
    await expect(persistenceService.openRequestFiles(request)).rejects.toThrow('read failed');
    expect(loadTextBody).not.toHaveBeenCalled();
  });

  it('writeTextBody() should remove its temporary file if the body cannot be replaced', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('rename failed'));

    // Act
    const writing = persistenceService.writeTextBody(request, 'body');

    // Assert
    await expect(writing).rejects.toThrow('rename failed');
    const dirPath = path.join(collection.dirPath, request.title);
    expect((await fs.readdir(dirPath)).filter((file) => file.startsWith('.'))).toEqual([]);
  });

  it('saveRequestInfo() should keep the old info file if it cannot be replaced', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    const dirPath = path.join(collection.dirPath, request.title);
    const infoFilePath = path.join(dirPath, getInfoFileName('request'));
    const before = await readFile(infoFilePath, 'utf-8');
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('rename failed'));

    // Act
    const writing = persistenceService.saveRequestInfo({ ...request, method: RequestMethod.PUT });

    // Assert
    await expect(writing).rejects.toThrow('rename failed');
    expect(await readFile(infoFilePath, 'utf-8')).toBe(before);
    expect((await fs.readdir(dirPath)).filter((file) => file.endsWith('.tmp'))).toEqual([]);
  });

  it('saveRequestInfo() should save the metadata of the request without touching its body', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await persistenceService.writeTextBody(request, 'body');
    const changed = freeze({ ...request, method: RequestMethod.PUT }, true);

    // Act
    await persistenceService.saveRequestInfo(changed);

    // Assert
    const dirPath = path.join(collection.dirPath, request.title);
    const info = JSON.parse(
      await readFile(path.join(dirPath, getInfoFileName('request')), 'utf-8')
    ) as RequestInfoFile;
    expect(info.method).toBe(RequestMethod.PUT);
    expect(await readFile(path.join(dirPath, TEXT_BODY_FILE_NAME), 'utf-8')).toBe('body');
  });

  it('saveRequestInfo() should write a draft into the draft directory', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);

    // Act
    await persistenceService.saveRequestInfo({ ...request, draft: true, title: 'draft' });

    // Assert
    const dirPath = path.join(collection.dirPath, request.title);
    const infoFileName = getInfoFileName('request');
    const saved = JSON.parse(await readFile(path.join(dirPath, infoFileName), 'utf-8'));
    const draft = JSON.parse(
      await readFile(path.join(dirPath, DRAFT_DIR_NAME, infoFileName), 'utf-8')
    );
    expect(saved.title).toBe(request.title);
    expect(draft.title).toBe('draft');
  });

  it('saveRequestInfo() should find an unused directory name', async () => {
    // Arrange requests
    const firstRequest = { ...getExampleRequest(collection.id), title: 'A B' };
    const secondRequest = { ...getExampleRequest(collection.id), title: 'A-B' };
    const thirdRequest = { ...getExampleRequest(collection.id), title: 'a b' };
    await persistenceService.saveCollection(collection, true);

    // Act
    await persistenceService.saveRequestInfo(firstRequest);
    await persistenceService.saveRequestInfo(secondRequest);
    await persistenceService.saveRequestInfo(thirdRequest);

    // Assert
    expect(await exists(path.join(collection.dirPath, 'a-b'))).toBe(true);
    expect(await exists(path.join(collection.dirPath, 'a-b-2'))).toBe(true);
    expect(await exists(path.join(collection.dirPath, 'a-b-3'))).toBe(true);
  });

  it('saveRequestInfo() should shorten directory names of very long titles', async () => {
    // Arrange: titles as long as e.g. an OpenAPI operation summary containing the whole endpoint
    // documentation. Both share a prefix, so their shortened directory names collide.
    const longTitle = `Takes native app file from request and creates new appstore application. ${'x'.repeat(300)}`;
    const firstRequest = { ...getExampleRequest(collection.id), title: longTitle };
    const secondRequest = { ...getExampleRequest(collection.id), title: longTitle };
    await persistenceService.saveCollection(collection, true);

    // Act
    await persistenceService.saveRequestInfo(firstRequest);
    await persistenceService.saveRequestInfo(secondRequest);

    // Assert
    const dirNames = (await fs.readdir(collection.dirPath, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(dirNames).toHaveLength(2);
    for (const dirName of dirNames) {
      expect(Buffer.byteLength(dirName)).toBeLessThanOrEqual(255);
    }
  });

  it('createDraft() should copy the saved body and scripts into the draft directory', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await persistenceService.writeTextBody(request, 'saved body');
    await persistenceService.saveScript(request, ScriptType.PRE_REQUEST, 'saved script');
    const draft = freeze({ ...request, draft: true, method: RequestMethod.POST }, true);

    // Act
    await persistenceService.createDraft(draft);

    // Assert
    const draftDirPath = path.join(collection.dirPath, request.title, DRAFT_DIR_NAME);
    expect(await readFile(path.join(draftDirPath, TEXT_BODY_FILE_NAME), 'utf-8')).toBe(
      'saved body'
    );
    expect(
      await readFile(path.join(draftDirPath, getScriptFileName(ScriptType.PRE_REQUEST)), 'utf-8')
    ).toBe('saved script');
    expect(await exists(path.join(draftDirPath, getScriptFileName(ScriptType.POST_RESPONSE)))).toBe(
      false
    );
    const info = JSON.parse(
      await readFile(path.join(draftDirPath, getInfoFileName('request')), 'utf-8')
    ) as RequestInfoFile;
    expect(info.method).toBe(RequestMethod.POST);
  });

  it('writeTextBody() and saveScript() should write into the draft directory of a draft', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await persistenceService.writeTextBody(request, 'saved');
    const draft = freeze({ ...request, draft: true }, true);
    await persistenceService.createDraft(draft);

    // Act
    await persistenceService.writeTextBody(draft, 'draft');
    await persistenceService.saveScript(draft, ScriptType.POST_RESPONSE, 'script');

    // Assert
    const dirPath = path.join(collection.dirPath, request.title);
    expect(await readFile(path.join(dirPath, TEXT_BODY_FILE_NAME), 'utf-8')).toBe('saved');
    expect(await readFile(path.join(dirPath, DRAFT_DIR_NAME, TEXT_BODY_FILE_NAME), 'utf-8')).toBe(
      'draft'
    );
    expect(await streamToString((await persistenceService.loadTextBodyOfRequest(draft))!)).toBe(
      'draft'
    );
    expect(
      await streamToString((await persistenceService.loadScript(draft, ScriptType.POST_RESPONSE))!)
    ).toBe('script');
    expect(await persistenceService.loadScript(request, ScriptType.POST_RESPONSE)).toBeUndefined();
  });

  it('copyRequestFiles() should copy the body and scripts of the current state of the source', async () => {
    // Arrange: the source has a draft with a changed body
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await persistenceService.writeTextBody(request, 'saved');
    const draft = freeze({ ...request, draft: true }, true);
    await persistenceService.createDraft(draft);
    await persistenceService.writeTextBody(draft, 'draft');
    await persistenceService.saveScript(draft, ScriptType.PRE_REQUEST, 'script');
    const copy = freeze({ ...request, id: randomUUID(), title: 'copy', draft: false }, true);
    await persistenceService.saveRequestInfo(copy);

    // Act
    await persistenceService.copyRequestFiles(draft, copy);

    // Assert
    const copyDirPath = path.join(collection.dirPath, 'copy');
    expect(await readFile(path.join(copyDirPath, TEXT_BODY_FILE_NAME), 'utf-8')).toBe('draft');
    expect(
      await readFile(path.join(copyDirPath, getScriptFileName(ScriptType.PRE_REQUEST)), 'utf-8')
    ).toBe('script');
    expect(await exists(path.join(copyDirPath, DRAFT_DIR_NAME))).toBe(false);
  });

  it('saveChanges() should overwrite the request with its draft', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await persistenceService.writeTextBody(request, 'saved');
    const draft = freeze({ ...request, draft: true, method: RequestMethod.POST }, true);
    await persistenceService.createDraft(draft);
    await persistenceService.writeTextBody(draft, 'draft');

    // Act
    await persistenceService.saveChanges(freeze({ ...draft, draft: false }, true));

    // Assert
    const dirPath = path.join(collection.dirPath, request.title);
    expect(await exists(path.join(dirPath, DRAFT_DIR_NAME))).toBe(false);
    const info = JSON.parse(
      await readFile(path.join(dirPath, getInfoFileName('request')), 'utf-8')
    ) as RequestInfoFile;
    expect(info.method).toBe(RequestMethod.POST);
    expect(await readFile(path.join(dirPath, TEXT_BODY_FILE_NAME), 'utf-8')).toBe('draft');
  });

  it('saveChanges() should remove saved files the draft no longer has', async () => {
    // Arrange: the saved request has secrets and scripts
    const request = {
      ...getExampleRequest(collection.id),
      auth: { type: AuthorizationType.BEARER, token: 'secret' },
    } satisfies TrufosRequest;
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await persistenceService.saveScript(request, ScriptType.PRE_REQUEST, 'pre');
    await persistenceService.saveScript(request, ScriptType.POST_RESPONSE, 'post');
    const { auth: _, ...withoutAuth } = request;
    const draft = freeze({ ...withoutAuth, draft: true }, true);
    await persistenceService.createDraft(draft);
    await persistenceService.saveScript(draft, ScriptType.PRE_REQUEST, '');
    const dirPath = path.join(collection.dirPath, request.title);
    await rm(path.join(dirPath, DRAFT_DIR_NAME, getScriptFileName(ScriptType.POST_RESPONSE)));

    // Act
    await persistenceService.saveChanges(freeze({ ...draft, draft: false }, true));

    // Assert
    expect(await exists(path.join(dirPath, DRAFT_DIR_NAME))).toBe(false);
    expect(await exists(path.join(dirPath, SECRETS_FILE_NAME))).toBe(false);
    expect(
      await readFile(path.join(dirPath, getScriptFileName(ScriptType.PRE_REQUEST)), 'utf-8')
    ).toBe('');
    expect(await exists(path.join(dirPath, getScriptFileName(ScriptType.POST_RESPONSE)))).toBe(
      false
    );
    const saved = await persistenceService.loadSavedRequest(request.id, collection.id);
    expect(saved).not.toHaveProperty('auth');
  });

  it('saveChanges() should delete temporary files left behind instead of saving them', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    const draft = freeze({ ...request, draft: true }, true);
    await persistenceService.createDraft(draft);
    const dirPath = path.join(collection.dirPath, request.title);
    const tempFileName = `.${TEXT_BODY_FILE_NAME}.${randomUUID()}.tmp`;
    await writeFile(path.join(dirPath, DRAFT_DIR_NAME, tempFileName), 'crashed');

    // Act
    await persistenceService.saveChanges(freeze({ ...draft, draft: false }, true));

    // Assert
    expect(await exists(path.join(dirPath, DRAFT_DIR_NAME))).toBe(false);
    expect(await exists(path.join(dirPath, tempFileName))).toBe(false);
    expect(await exists(path.join(dirPath, getInfoFileName('request')))).toBe(true);
  });

  it('saveChanges() should do nothing for a request without a draft', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await persistenceService.writeTextBody(request, 'saved');
    const dirPath = path.join(collection.dirPath, request.title);
    const files = await fs.readdir(dirPath);

    // Act
    await persistenceService.saveChanges(request);

    // Assert
    expect(await fs.readdir(dirPath)).toEqual(files);
    expect(await readFile(path.join(dirPath, TEXT_BODY_FILE_NAME), 'utf-8')).toBe('saved');
  });

  it('discardChanges() should delete the draft and keep the saved state', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    const draft = freeze({ ...request, draft: true, method: RequestMethod.POST }, true);
    await persistenceService.createDraft(draft);

    // Act
    await persistenceService.discardChanges(draft);

    // Assert
    const dirPath = path.join(collection.dirPath, request.title);
    expect(await exists(path.join(dirPath, DRAFT_DIR_NAME))).toBe(false);
    const saved = await persistenceService.loadSavedRequest(request.id, collection.id);
    expect(saved?.method).toBe(RequestMethod.GET);
  });

  it('discardChanges() should delete a request that was never saved', async () => {
    // Arrange
    await persistenceService.saveCollection(collection, true);
    const request = freeze({ ...getExampleRequest(collection.id), draft: true }, true);
    await persistenceService.saveRequestInfo(request);
    await persistenceService.writeTextBody(request, '');
    const dirPath = path.join(collection.dirPath, request.title);
    expect(await exists(path.join(dirPath, DRAFT_DIR_NAME))).toBe(true);

    // Act
    await persistenceService.discardChanges(request);

    // Assert: the directory is gone and its name is free again
    expect(await exists(dirPath)).toBe(false);
    await persistenceService.saveRequestInfo({ ...getExampleRequest(collection.id) });
    expect(await exists(dirPath)).toBe(true);
  });

  it('discardChanges() should not throw when the draft directory is missing', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);

    // Act & Assert
    await persistenceService.discardChanges({ ...request, draft: true });
    expect(await exists(path.join(collection.dirPath, request.title))).toBe(true);
  });

  it('loadSavedRequest() should load the saved state of a request with a draft', async () => {
    // Arrange
    const request = getExampleRequest(collection.id);
    collection.children.push(request);
    await persistenceService.saveCollection(collection, true);
    await persistenceService.createDraft({ ...request, draft: true, method: RequestMethod.POST });

    // Act
    const loaded = await persistenceService.loadCollection(collection.dirPath);
    const saved = await persistenceService.loadSavedRequest(request.id, collection.id);

    // Assert
    expect(loaded.children[0]).toMatchObject({ draft: true, method: RequestMethod.POST });
    expect(saved).toMatchObject({ id: request.id, draft: false, method: RequestMethod.GET });
  });

  it('loadSavedRequest() should return undefined for a request that was never saved', async () => {
    // Arrange
    await persistenceService.saveCollection(collection, true);
    const request = { ...getExampleRequest(collection.id), draft: true };
    await persistenceService.saveRequestInfo(request);

    // Act & Assert
    expect(await persistenceService.loadSavedRequest(request.id, collection.id)).toBeUndefined();
  });

  it('deleteNode() should delete the directory of a folder and forget its descendants', async () => {
    // Arrange
    const folder = getExampleFolderWithChildren(collection.id);
    collection.children.push(folder);
    await persistenceService.saveCollection(collection, true);
    const child = folder.children[1] as TrufosRequest;

    // Act
    await persistenceService.deleteNode(folder.id);

    // Assert
    expect(await exists(path.join(collection.dirPath, folder.title))).toBe(false);
    await expect(persistenceService.saveRequestInfo(child)).rejects.toThrow();
  });

  it('saveCollectionInfo() should save a collection without children', async () => {
    // Arrange
    const { children: _, ...info } = collection;

    // Act
    await persistenceService.saveCollectionInfo(freeze({ ...info, title: 'renamed' }, true));

    // Assert
    const saved = JSON.parse(
      await readFile(path.join(collection.dirPath, getInfoFileName('collection')), 'utf-8')
    ) as CollectionInfoFile;
    expect(saved.title).toBe('renamed');
  });
});

import { Collection, CollectionObject } from 'main/persistence/entity/collection';
import { Folder, FolderObject } from 'main/persistence/entity/folder';
import { DirectoryWithInfoType } from 'main/persistence/entity/directory-with-info';
import { dirSync } from 'tmp';
import { Request, RequestObject } from 'main/persistence/entity/request';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import fs from 'fs/promises';
import path from 'path';
import { InternalError, InternalErrorType } from 'main/error/internal-error';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('')
  }
}));

describe('PersistenceService', () => {
  it('should persist the given entities when storeCollection() is called', async () => {

    // Arrange
    const collectionDir = dirSync({ unsafeCleanup: true }).name;
    const collectionObj: CollectionObject = {
      version: 'v1',
      variables: {
        'var1': { value: 'value1', enabled: true },
        'var2': { value: 'value2', enabled: false }
      },
      title: 'My Great Collection',
      type: DirectoryWithInfoType.COLLECTION
    };
    const collection = new Collection(
      collectionObj,
      'my-great-collection',
      collectionDir
    );

    const folderObj: FolderObject = {
      version: 'v1',
      title: 'My Great Folder',
      type: DirectoryWithInfoType.FOLDER
    };
    const directory = new Folder(
      folderObj,
      'my-great-folder',
      collection
    );
    collection.addChild(directory);

    const requestObj: RequestObject = {
      version: 'v1',
      title: 'My Great Request',
      type: DirectoryWithInfoType.REQUEST,
      url: 'https://example.com',
      method: 'GET',
      headers: {},
      bodyInfo: { type: 'text', mimeType: 'text/plain' }
    };
    const request = new Request(
      requestObj,
      'my-great-request',
      directory
    );
    directory.addChild(request);

    // create global fs/promises mock
    const persistenceService = new PersistenceService();

    // Act
    await persistenceService.storeCollection(collection);

    // Assert
    const actualCollectionObj = JSON.parse(await fs.readFile(path.join(collection.dirPath, 'info.json'), 'utf8'));
    expect(actualCollectionObj).toEqual(collectionObj);
    const actualFolderObj = JSON.parse(await fs.readFile(path.join(directory.dirPath, 'info.json'), 'utf8'));
    expect(actualFolderObj).toEqual(folderObj);
    const actualRequestObj = JSON.parse(await fs.readFile(path.join(request.dirPath, 'info.json'), 'utf8'));
    expect(actualRequestObj).toEqual(requestObj);
  });

  it('should load the persisted entities correctly', async () => {
    // Arrange
    const collectionObj: CollectionObject = {
      version: 'v1',
      variables: {},
      title: 'My Great Collection',
      type: DirectoryWithInfoType.COLLECTION
    };
    const folderObj: FolderObject = {
      version: 'v1',
      title: 'My Great Folder',
      type: DirectoryWithInfoType.FOLDER
    };
    const requestObj: RequestObject = {
      version: 'v1',
      title: 'My Great Request',
      type: DirectoryWithInfoType.REQUEST,
      url: 'https://example.com',
      method: 'GET',
      headers: {},
      bodyInfo: { type: 'text', mimeType: 'text/plain' }
    };

    const tmpDir = dirSync({ unsafeCleanup: true }).name;
    const collectionDirPath = path.join(tmpDir, 'my-great-collection');
    await fs.mkdir(collectionDirPath);
    await fs.writeFile(path.join(collectionDirPath, 'info.json'), JSON.stringify(collectionObj));
    const folderDirPath = path.join(collectionDirPath, 'my-great-folder');
    await fs.mkdir(folderDirPath);
    await fs.writeFile(path.join(folderDirPath, 'info.json'), JSON.stringify(folderObj));
    const requestDirPath = path.join(folderDirPath, 'my-great-request');
    await fs.mkdir(requestDirPath);
    await fs.writeFile(path.join(requestDirPath, 'info.json'), JSON.stringify(requestObj));

    const persistenceService = new PersistenceService();

    // Act
    const collection = await persistenceService.loadCollection(collectionDirPath);

    // Assert
    expect(collection.title).toEqual(collectionObj.title);
    expect(collection.children.length).toEqual(1);
    const folder = collection.children[0] as Folder;
    expect(folder).toBeInstanceOf(Folder);
    expect(folder.title).toEqual(folderObj.title);
    expect(folder.children.length).toEqual(1);
    const request = folder.children[0] as Request;
    expect(request).toBeInstanceOf(Request);
    expect(request.title).toEqual(requestObj.title);
    expect(request.url).toEqual(requestObj.url);
    expect(request.method).toEqual(requestObj.method);
    expect(request.headers).toEqual(requestObj.headers);
    expect(request.body.type).toEqual(requestObj.bodyInfo.type);
  });

  it('should throw in loadCollection() if there is a nested collection', async () => {
    // Arrange
    const collectionObj: CollectionObject = {
      version: 'v1',
      variables: {},
      title: 'My Great Collection',
      type: DirectoryWithInfoType.COLLECTION
    };

    const tmpDir = dirSync({ unsafeCleanup: true }).name;
    const collectionDirPath = path.join(tmpDir, 'my-great-collection');
    await fs.mkdir(collectionDirPath);
    await fs.writeFile(path.join(collectionDirPath, 'info.json'), JSON.stringify(collectionObj));
    const nestedCollectionDirPath = path.join(collectionDirPath, 'my-great-collection');
    await fs.mkdir(nestedCollectionDirPath);
    await fs.writeFile(path.join(nestedCollectionDirPath, 'info.json'), JSON.stringify(collectionObj));

    const persistenceService = new PersistenceService();

    // Act & Assert
    await expect(() => persistenceService.loadCollection(collectionDirPath)).rejects
    .toThrow(
      new InternalError(
        InternalErrorType.COLLECTION_LOAD_ERROR,
        'A collection cannot be a child of another collection'
      )
    );
  });

  it('should throw in loadCollection() when the given directory is not a collection', async () => {
    // Arrange
    const folderObj: FolderObject = {
      version: 'v1',
      title: 'My Great Folder',
      type: DirectoryWithInfoType.FOLDER
    };

    const tmpDir = dirSync({ unsafeCleanup: true }).name;
    const folderDirPath = path.join(tmpDir, 'my-great-folder');
    await fs.mkdir(folderDirPath);
    await fs.writeFile(path.join(folderDirPath, 'info.json'), JSON.stringify(folderObj));

    const persistenceService = new PersistenceService();

    // Act & Assert
    await expect(() => persistenceService.loadCollection(folderDirPath)).rejects
    .toThrow(
      new InternalError(
        InternalErrorType.COLLECTION_LOAD_ERROR,
        'The given directory is not a collection'
      )
    );
  });

  it('should throw in loadCollection() one of the directories is missing an info file', async () => {
    // Arrange
    const tmpDir = dirSync({ unsafeCleanup: true }).name;
    const persistenceService = new PersistenceService();

    // Act & Assert
    await expect(() => persistenceService.loadCollection(tmpDir)).rejects
    .toThrow(
      new InternalError(
        InternalErrorType.COLLECTION_LOAD_ERROR,
        `The info file of the directory ${tmpDir} does not exist`
      )
    );
  });
});

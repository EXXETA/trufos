import fs from 'node:fs/promises';
import path from 'node:path';
import { Collection, CollectionObject } from '../entity/collection';
import { Folder, FolderObject } from '../entity/folder';
import {
  DirectoryWithInfo,
  DirectoryWithInfoObject,
  DirectoryWithInfoType
} from '../entity/directory-with-info';
import { Request, RequestObject } from '../entity/request';
import { InternalError, InternalErrorType } from 'main/error/internal-error';
import { exists, USER_DATA_DIR } from 'main/util/fs-util';

/**
 * A service to persist collections, directories and requests to the file system
 */
export class PersistenceService {

  private static readonly DIRECTORY_INFO_FILE_NAME = 'info.json';
  private static readonly DEFAULT_COLLECTION_DIR = path.join(USER_DATA_DIR, 'default-collection');

  public static readonly instance = new PersistenceService();

  /**
   * Loads or creates the default collection in the user data directory
   */
  public async loadDefaultCollection() {
    const dirPath = PersistenceService.DEFAULT_COLLECTION_DIR;
    if (await exists(dirPath)) {
      return this.loadCollection(dirPath);
    }

    // create a new default collection
    console.info('Creating default collection at', dirPath);
    const collection = new Collection({
        version: 'v1',
        type: DirectoryWithInfoType.COLLECTION,
        variables: {},
        title: 'Default'
      },
      path.basename(PersistenceService.DEFAULT_COLLECTION_DIR),
      path.dirname(PersistenceService.DEFAULT_COLLECTION_DIR)
    );

    // store and return the default collection
    await this.storeCollection(collection);
    return collection;
  }


  /**
   * Loads a collection and all of its directories and requests from the file system
   * @param dirPath The absolute path to the directory which represents the collection
   */
  public async loadCollection(dirPath: string) {
    try {
      const collectionInfo = await this.loadDirectoryInfo<CollectionObject>(dirPath);
      if (collectionInfo.type !== DirectoryWithInfoType.COLLECTION) {
        throw new InternalError(InternalErrorType.COLLECTION_LOAD_ERROR, 'The given directory is not a collection');
      }
      const collection = new Collection(collectionInfo, path.basename(dirPath), dirPath);
      await this.loadChildren(dirPath, collection);
      return collection;
    } catch (e) {
      if (e instanceof InternalError) {
        throw e;
      } else {
        console.error('Error while loading collection', e);
        throw new InternalError(InternalErrorType.COLLECTION_LOAD_ERROR, 'Error while loading collection', e);
      }
    }
  }

  private async loadChildren(dirPath: string, parent: DirectoryWithInfo) {
    for (const fileNode of await fs.readdir(dirPath, { withFileTypes: true })) {
      if (fileNode.isDirectory()) {
        const childDirPath = path.join(dirPath, fileNode.name);
        const directoryInfo = await this.loadDirectoryInfo(childDirPath);
        let child: DirectoryWithInfo;
        switch (directoryInfo.type) {
          case DirectoryWithInfoType.COLLECTION:
            throw new InternalError(InternalErrorType.COLLECTION_LOAD_ERROR, 'A collection cannot be a child of another collection');
          case DirectoryWithInfoType.FOLDER:
            child = await this.loadDirectory(directoryInfo, childDirPath, parent);
            break;
          case DirectoryWithInfoType.REQUEST:
            child = await this.loadRequest(directoryInfo, childDirPath, parent);
            break;
          default:
            console.warn(`Unknown directory type: ${(directoryInfo as { type: any }).type}`);
            continue;
        }
        parent.addChild(child);
      }
    }
  }

  /**
   * Loads a directory and all of its children from the file system
   * @param directoryInfo The info object of the directory
   * @param dirPath The absolute path to the directory which represents the request
   * @param parent The parent directory of the request
   */
  private async loadDirectory(directoryInfo: FolderObject, dirPath: string, parent: DirectoryWithInfo) {
    const directory = new Folder(directoryInfo, path.basename(dirPath), parent);
    await this.loadChildren(dirPath, directory);
    return directory;
  }

  /**
   * Loads a request from the file system
   * @param requestInfo The info object of the request
   * @param dirPath The absolute path to the directory which represents the request
   * @param parent The parent directory of the request
   */
  private async loadRequest(requestInfo: RequestObject, dirPath: string, parent: DirectoryWithInfo) {
    return new Request(requestInfo, path.basename(dirPath), parent);
  }

  /**
   * Stores a collection and all of its directories and requests to the file system
   * @param collection The collection to store
   */
  public async storeCollection(collection: Collection) {
    try {
      await this.storeDirectory(collection);
      return collection;
    } catch (e) {
      console.error(`Error while storing collection: ${e}`);
      throw new InternalError(InternalErrorType.COLLECTION_SAVE_ERROR, 'Error while storing collection', e);
    }
  }

  /**
   * Recursively stores a directory and all of its children to the file system
   * @param directory The directory to store
   */
  private async storeDirectory(directory: DirectoryWithInfo) {
    await fs.mkdir(directory.dirPath, { recursive: true });
    const infoFilePath = path.join(directory.dirPath, PersistenceService.DIRECTORY_INFO_FILE_NAME);
    await fs.writeFile(infoFilePath, JSON.stringify(directory.toObject(), null, 2), 'utf8');
    if (directory instanceof Request) await this.storeRequestBody(directory);
    for (const child of directory.children) {
      await this.storeDirectory(child);
    }
  }

  /**
   * Stores the request body of the given request to the file system (if applicable)
   * @param request The request to store the body of
   */
  private async storeRequestBody(request: Request) {
    const requestBody = request.body;
    if (requestBody.type === 'text' && requestBody.text !== undefined) {
      const bodyFilePath = path.join(request.dirPath, Request.TEXT_BODY_FILE_NAME);
      await fs.writeFile(bodyFilePath, requestBody.text, 'utf8');
    }
  }

  /**
   * Loads the info file of a directory
   * @param dirPath The absolute path to the directory
   */
  private async loadDirectoryInfo<T extends DirectoryWithInfoObject = CollectionObject | FolderObject | RequestObject>(dirPath: string) {
    const filePath = path.join(dirPath, PersistenceService.DIRECTORY_INFO_FILE_NAME);
    if (!await exists(filePath)) {
      throw new InternalError(InternalErrorType.COLLECTION_LOAD_ERROR, `The info file of the directory ${dirPath} does not exist`);
    }
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  }

}

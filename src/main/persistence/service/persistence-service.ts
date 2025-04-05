import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import {
  CollectionInfoFile,
  FolderInfoFile,
  fromCollectionInfoFile,
  fromFolderInfoFile,
  fromRequestInfoFile,
  InfoFile,
  RequestInfoFile,
  toInfoFile,
  VERSION,
} from './info-files/latest';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import {
  DRAFT_TEXT_BODY_FILE_NAME,
  RequestBodyType,
  TrufosRequest,
  TEXT_BODY_FILE_NAME,
  TextBody,
} from 'shim/objects/request';
import { exists } from 'main/util/fs-util';
import { isCollection, isFolder, isRequest, TrufosObject } from 'shim/objects';
import { generateDefaultCollection } from './default-collection';
import { randomUUID } from 'node:crypto';
import { migrateInfoFile } from './info-files/migrators';
import { SemVer } from 'main/util/semver';
import { SettingsService } from './settings-service';

/** Content of the .gitignore file for a collection */
const COLLECTION_GITIGNORE = ['~request.json'].join('\n');

/**
 * This service is responsible for persisting and loading collections, folders, and requests
 * to and from the file system. If you want to open a collection, you should use the
 * {@link EnvironmentService.changeCollection} which will call this service internally.
 */
export class PersistenceService {
  public static readonly instance = new PersistenceService();

  private readonly idToPathMap: Map<string, string> = new Map();

  /**
   * Creates the default collection if it does not exist.
   */
  public async createDefaultCollectionIfNotExists() {
    const dirPath = SettingsService.DEFAULT_COLLECTION_DIR;
    if (!(await exists(path.join(dirPath, 'collection.json')))) {
      logger.info('Creating default collection at', dirPath);
      const collection = generateDefaultCollection(dirPath);
      await this.saveCollectionRecursive(collection);
    }
  }

  /**
   * Moves a child object from one parent to another on the file system.
   * @param child the child object that gets moved
   * @param oldParent the parent object the child is currently in
   * @param newParent the parent object the child gets moved to
   */
  public async moveChild(
    child: Folder | TrufosRequest,
    oldParent: Folder | Collection,
    newParent: Folder | Collection
  ) {
    const childDirName = this.getDirName(child);
    const oldChildDirPath = this.getDirPath(child);
    const newParentDirPath = this.getDirPath(newParent);
    const newChildDirPath = path.join(newParentDirPath, childDirName);

    oldParent.children = oldParent.children.filter((c) => c.id !== child.id);
    newParent.children.push(child);
    await fs.rename(oldChildDirPath, newChildDirPath);

    this.updatePathMapRecursively(child, newParentDirPath);
  }

  /**
   * Renames a trufos object on the file system.
   * @param object trufos object to be renamed
   * @param newTitle new title of the object
   */
  public async rename(object: TrufosObject, newTitle: string) {
    const oldDirPath = this.getDirPath(object);
    object.title = newTitle;
    const newDirPath = path.join(path.dirname(oldDirPath), this.getDirName(object));

    logger.info('Renaming object at', oldDirPath, 'to', newDirPath);
    await fs.rename(oldDirPath, newDirPath);

    this.idToPathMap.set(object.id, newDirPath);

    if (isCollection(object)) {
      object.dirPath = newDirPath;
    }
    if (!isRequest(object)) {
      for (const child of object.children) {
        this.updatePathMapRecursively(child, newDirPath);
      }
    }
  }

  /**
   * Creates or updates a request and optionally its text body on the file system.
   * @param request the request to be saved
   * @param textBody OPTIONAL: the text body of the request
   */
  public async saveRequest(request: TrufosRequest, textBody?: string) {
    const dirPath = this.getDirPath(request);
    const infoFileName = `${request.draft ? '~' : ''}${request.type}.json`;
    await this.saveInfoFile(request, dirPath, infoFileName);

    // save text body if provided
    if (textBody != null) {
      const body = request.body as TextBody;
      body.type = RequestBodyType.TEXT; // enforce type
      delete body.text; // only present once, if imported collection
      const fileName = request.draft ? DRAFT_TEXT_BODY_FILE_NAME : TEXT_BODY_FILE_NAME;
      await fs.writeFile(path.join(dirPath, fileName), textBody);
    } else if (await exists(path.join(dirPath, TEXT_BODY_FILE_NAME))) {
      await fs.unlink(path.join(dirPath, TEXT_BODY_FILE_NAME));
    }
    return request;
  }

  /**
   * Saves the given collection to the file system. This is not recursive.
   * @param collection the collection to save
   */
  public async saveCollection(collection: Collection) {
    await this.saveInfoFile(collection, this.getDirPath(collection), collection.type + '.json');
  }

  /**
   * Saves the given folder to the file system.
   * @param folder the folder to save
   */
  public async saveFolder(folder: Folder) {
    await this.saveInfoFile(folder, this.getDirPath(folder), folder.type + '.json');
  }

  /**
   * Saves the information of a trufos object to the file system.
   * @param object the object to save
   * @param dirPath the directory path to save the object to
   * @param fileName the name of the information file
   */
  private async saveInfoFile(object: TrufosObject, dirPath: string, fileName: string) {
    logger.info('Saving object', (object.id ??= randomUUID()));
    if (!isCollection(object) && object.parentId == null) {
      throw new Error('Object must have a parent');
    } else if (!(await exists(dirPath))) {
      await fs.mkdir(dirPath);
    }

    const infoFileContents = toInfoFile(object);
    const infoFilePath = path.join(dirPath, fileName);
    await fs.writeFile(infoFilePath, JSON.stringify(infoFileContents, null, 2));
    this.idToPathMap.set(object.id, dirPath);
  }

  /**
   * Recursively saves a collection and all of its children to the file system.
   * @param collection the collection to save
   */
  public async saveCollectionRecursive(collection: Collection) {
    await this.saveCollection(collection);

    const queue: TrufosObject[] = [...collection.children];
    while (queue.length > 0) {
      const child = queue.shift();
      if (isRequest(child)) {
        await this.saveRequest(child);
      } else if (isFolder(child)) {
        await this.saveFolder(child);
        queue.push(...child.children);
      }
    }
  }

  /**
   * Checks if a draft exists for the given request and returns the draft information.
   * Also sets the draft flag of the request to false.
   * @param request the request to mark as not a draft
   */
  private async undraft(request: TrufosRequest) {
    request.draft = false;
    const infoFileName = request.type + '.json';
    const dirPath = this.getDirPath(request);
    if (!(await exists(path.join(dirPath, '~' + infoFileName)))) {
      return { draft: false };
    }

    return { draft: true, dirPath, infoFileName };
  }

  /**
   * Overrides all information with the draft information. This does not write
   * any information to the file system. This only overrides the information
   * file with the draft information file.
   *
   * @param request the request to save the draft of
   */
  public async saveChanges(request: TrufosRequest) {
    const { draft, dirPath, infoFileName } = await this.undraft(request);
    if (draft) {
      logger.info('Saving changes of request at', dirPath);
      await fs.rename(path.join(dirPath, '~' + infoFileName), path.join(dirPath, infoFileName));
      if (isRequest(request)) {
        const draftBodyFilePath = path.join(dirPath, DRAFT_TEXT_BODY_FILE_NAME);
        const bodyFilePath = path.join(dirPath, TEXT_BODY_FILE_NAME);
        if (await exists(draftBodyFilePath)) {
          await fs.rename(draftBodyFilePath, bodyFilePath);
        } else if (await exists(bodyFilePath)) {
          await fs.unlink(bodyFilePath);
        }
      }
    }

    return request;
  }

  /**
   * Discards all draft information.
   * @param request the request to discard the draft of
   */
  public async discardChanges(request: TrufosRequest) {
    const { draft, dirPath, infoFileName } = await this.undraft(request);
    if (!draft) {
      return request;
    }
    logger.info('Discarding changes of request at', dirPath);

    // delete draft files
    await fs.unlink(path.join(dirPath, '~' + infoFileName));
    if (isRequest(request) && (await exists(path.join(dirPath, DRAFT_TEXT_BODY_FILE_NAME)))) {
      await fs.unlink(path.join(dirPath, DRAFT_TEXT_BODY_FILE_NAME));
    }

    return await this.loadRequest(request.parentId, dirPath);
  }

  /**
   * Deletes an object and all of its children from the file system. Also removes
   * the object(s) from the path map.
   * @param object the object to delete
   */
  public async delete(object: TrufosObject) {
    const dirPath = this.getDirPath(object);
    logger.info('Deleting object at', dirPath);

    // delete children first
    if (!isRequest(object)) {
      for (const child of object.children) {
        await this.delete(child);
      }
    }

    // delete object
    this.idToPathMap.delete(object.id);
    await fs.rm(dirPath, { recursive: true });
  }

  /**
   * Loads the text body of a request from the file system.
   * @param request the request to load the text body for
   * @param encoding the encoding of the text body. Default is binary.
   * @returns the text body of the request if it exists
   */
  public async loadTextBodyOfRequest(request: TrufosRequest, encoding?: BufferEncoding) {
    logger.info('Loading text body of request', request.id);
    if (request.body.type === RequestBodyType.TEXT) {
      const fileName = request.draft ? DRAFT_TEXT_BODY_FILE_NAME : TEXT_BODY_FILE_NAME;
      const filePath = path.join(this.getDirPath(request), fileName);
      if (await exists(filePath)) {
        logger.debug(`Opening text body file at ${filePath}`);
        return createReadStream(filePath, encoding);
      }
      logger.warn('Text body file does not exist for request', request.id);
    }
  }

  /**
   * Creates a new collection at the specified directory path.
   * @param dirPath the directory path where the collection should be created
   * @param title the title of the collection
   */
  public async createCollection(dirPath: string, title: string): Promise<Collection> {
    logger.info('Creating new collection at', dirPath);
    if ((await fs.readdir(dirPath)).some((file) => file !== '.DS_Store')) {
      throw new Error('Directory is not empty');
    }

    const collection: Collection = {
      id: randomUUID(),
      title: title,
      type: 'collection',
      dirPath,
      variables: {},
      environments: {},
      children: [],
    };
    await this.saveCollection(collection); // save collection file
    await fs.writeFile(path.join(dirPath, '.gitignore'), COLLECTION_GITIGNORE); // create .gitignore
    return collection;
  }

  /**
   * Loads a collection and all of its children from the file system.
   * @param dirPath the directory path where the collection is located
   * @returns the loaded collection
   */
  public async loadCollection(dirPath: string): Promise<Collection> {
    logger.info('Loading collection at', dirPath);
    const type = 'collection' as const;
    const info = await this.readInfoFile(dirPath, type);
    this.idToPathMap.set(info.id, dirPath);
    const children = await this.loadChildren(info.id, dirPath);

    return fromCollectionInfoFile(info, dirPath, children);
  }

  private async loadRequest(parentId: string, dirPath: string): Promise<TrufosRequest> {
    const type = 'request' as const;
    const draft = await exists(path.join(dirPath, '~' + type + '.json'));
    const info = await this.readInfoFile(dirPath, type, draft);
    this.idToPathMap.set(info.id, dirPath);

    return fromRequestInfoFile(info, parentId, draft);
  }

  private async loadFolder(parentId: string, dirPath: string): Promise<Folder> {
    const type = 'folder' as const;
    const info = await this.readInfoFile(dirPath, type);
    this.idToPathMap.set(info.id, dirPath);
    const children = await this.loadChildren(info.id, dirPath);

    return fromFolderInfoFile(info, parentId, children);
  }

  private async loadChildren(
    parentId: string,
    parentDirPath: string
  ): Promise<(Folder | TrufosRequest)[]> {
    const children: (Folder | TrufosRequest)[] = [];

    for (const node of await fs.readdir(parentDirPath, {
      withFileTypes: true,
    })) {
      if (!node.isDirectory()) {
        continue;
      }

      const child = await this.load(parentId, path.join(parentDirPath, node.name));
      if (child != null) {
        children.push(child);
      }
    }

    return children;
  }

  private async load<T extends TrufosRequest | Folder>(
    parentId: string,
    dirPath: string,
    type?: T['type']
  ): Promise<T> {
    if (type === 'folder' || (await exists(path.join(dirPath, 'folder.json')))) {
      return (await this.loadFolder(parentId, dirPath)) as T;
    } else if (
      type === 'request' ||
      (await exists(path.join(dirPath, 'request.json'))) ||
      (await exists(path.join(dirPath, '~request.json')))
    ) {
      return (await this.loadRequest(parentId, dirPath)) as T;
    }
  }

  private readInfoFile(dirPath: string, type: Collection['type']): Promise<CollectionInfoFile>;
  private readInfoFile(dirPath: string, type: Folder['type']): Promise<FolderInfoFile>;
  private readInfoFile(
    dirPath: string,
    type: TrufosRequest['type'],
    draft: boolean
  ): Promise<RequestInfoFile>;

  private async readInfoFile<T extends TrufosObject>(
    dirPath: string,
    type: T['type'],
    draft = false
  ) {
    const filePath = path.join(dirPath, `${draft ? '~' : ''}${type}.json`);
    const info = JSON.parse(await fs.readFile(filePath, 'utf8')) as InfoFile;

    // check if the version is supported
    if (SemVer.parse(info.version).isNewerThan(VERSION)) {
      throw new Error(
        `The version of the loaded ${type} info file is newer than latest supported version ${VERSION}. Please update the application.`
      );
    }

    // potentially migrate the info file to latest version
    return await migrateInfoFile(info, type);
  }

  private updatePathMapRecursively(child: Folder | TrufosRequest, newParentDirPath: string) {
    const oldDirPath = this.idToPathMap.get(child.id);
    const dirName = path.basename(oldDirPath);
    const newDirPath = path.join(newParentDirPath, dirName);
    this.idToPathMap.set(child.id, newDirPath);
    if (isFolder(child)) {
      for (const grandChild of child.children) {
        this.updatePathMapRecursively(grandChild, newDirPath);
      }
    }
  }

  private getDirPath(object: TrufosObject) {
    if (isCollection(object)) {
      return object.dirPath;
    } else if (this.idToPathMap.has(object.id)) {
      return this.idToPathMap.get(object.id);
    } else {
      // must derive the path from parent
      const parentDirPath = this.idToPathMap.get(object.parentId);
      return path.join(parentDirPath, this.getDirName(object));
    }
  }

  private getDirName(object: TrufosObject) {
    return this.sanitizeTitle(object.title);
  }

  private sanitizeTitle(title: string) {
    return title
      .toLowerCase()
      .replace(/\s/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }
}

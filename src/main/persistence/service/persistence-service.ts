import { exists } from 'main/util/fs-util';
import { assign } from 'main/util/object-util';
import { SemVer } from 'main/util/semver';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { EOL } from 'node:os';
import path from 'node:path';
import { isCollection, isFolder, isRequest, TrufosObject } from 'shim/objects';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import {
  DRAFT_TEXT_BODY_FILE_NAME,
  RequestBodyType,
  TEXT_BODY_FILE_NAME,
  TextBody,
  TrufosRequest,
} from 'shim/objects/request';
import { generateDefaultCollection } from './default-collection';
import {
  CollectionInfoFile,
  extractSecrets,
  FolderInfoFile,
  fromCollectionInfoFile,
  fromFolderInfoFile,
  fromRequestInfoFile,
  InfoFile,
  RequestInfoFile,
  toInfoFile,
  VERSION,
} from './info-files/latest';
import { migrateInfoFile } from './info-files/migrators';
import { SecretService } from './secret-service';
import { SettingsService } from './settings-service';

export const HIDDEN_FILE_PREFIX = '~';

/** Content of the .gitignore file for a collection */
const COLLECTION_GITIGNORE = [`${HIDDEN_FILE_PREFIX}*`].join(EOL);

function normalizeDirPath(dirPath: string) {
  dirPath = path.normalize(dirPath);
  if (dirPath.endsWith(path.sep)) {
    dirPath = dirPath.slice(0, -1);
  }
  return dirPath;
}

export function getInfoFileName(type: TrufosObject['type'], draft = false) {
  return `${draft ? HIDDEN_FILE_PREFIX : ''}${type}.json`;
}

export function getSecretsFileName(draft = false) {
  return `${draft ? HIDDEN_FILE_PREFIX : ''}${HIDDEN_FILE_PREFIX}secrets.json.bin`;
}

const secretService = SecretService.instance;

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
    if (!(await exists(path.join(dirPath, getInfoFileName('collection'))))) {
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
    const oldChildDirPath = this.getOrCreateDirPath(child);
    const newParentDirPath = this.getOrCreateDirPath(newParent);
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
    const oldDirPath = this.getOrCreateDirPath(object);
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
    const dirPath = this.getOrCreateDirPath(request);
    const infoFileName = getInfoFileName(request.type, request.draft);
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
    await this.saveInfoFile(
      collection,
      this.getOrCreateDirPath(collection),
      getInfoFileName(collection.type)
    );
  }

  /**
   * Saves the given folder to the file system.
   * @param folder The folder to save.
   * @param recursive Whether to also save all children of the folder recursively. Defaults to false.
   */
  public async saveFolder(folder: Folder, recursive: boolean = false) {
    await this.saveInfoFile(folder, this.getOrCreateDirPath(folder), getInfoFileName(folder.type));

    if (recursive) {
      for (const child of folder.children) {
        if (isRequest(child)) {
          await this.saveRequest(child);
        } else if (isFolder(child)) {
          await this.saveFolder(child, true);
        }
      }
    }
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

    // remove secrets from variables and save them separately
    await this.saveSecrets(object, dirPath);

    // write the info file
    await fs.writeFile(path.join(dirPath, fileName), JSON.stringify(toInfoFile(object), null, 2));
    this.idToPathMap.set(object.id, dirPath);
  }

  /**
   * Removes secrets from the given trufos object and saves them to a separate file.
   * @param object the trufos object to extract secrets from
   * @param dirPath the directory path where the secrets should be saved
   */
  private async saveSecrets(object: TrufosObject, dirPath: string) {
    const filePath = path.join(dirPath, getSecretsFileName(isRequest(object) && object.draft));
    const secrets = extractSecrets(object);
    if (Object.keys(secrets).length > 0) {
      logger.debug(`Saving secrets for ${object.type} with ID [${object.id}]`);
      await fs.writeFile(filePath, secretService.encrypt(JSON.stringify(secrets)));
    } else if (await exists(filePath)) {
      logger.debug(`Removing secrets file for ${object.type} with ID [${object.id}]`);
      await fs.unlink(filePath);
    }
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
    const dirPath = this.getOrCreateDirPath(request);
    if (!(await exists(path.join(dirPath, getInfoFileName(request.type, true))))) {
      return { draft: false };
    }

    return { draft: true, dirPath, infoFileName: getInfoFileName(request.type, request.draft) };
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
      await fs.rename(
        path.join(dirPath, HIDDEN_FILE_PREFIX + infoFileName),
        path.join(dirPath, infoFileName)
      );

      this.moveDraftFileToOriginal(
        path.join(dirPath, DRAFT_TEXT_BODY_FILE_NAME),
        path.join(dirPath, TEXT_BODY_FILE_NAME)
      );
      this.moveDraftFileToOriginal(
        path.join(dirPath, getSecretsFileName(true)),
        path.join(dirPath, getSecretsFileName())
      );
    }

    return request;
  }

  private async moveDraftFileToOriginal(draftFilePath: string, originalFilePath: string) {
    if (await exists(draftFilePath)) {
      logger.info('Moving draft file to original file', draftFilePath, '->', originalFilePath);
      await fs.rename(draftFilePath, originalFilePath);
    } else if (await exists(originalFilePath)) {
      logger.warn('Draft file does not exist, but original file exists. Deleting original file.');
      await fs.unlink(originalFilePath);
    }
  }

  /**
   * Discards all draft information.
   * @param request the request to discard the draft of
   */
  public async discardChanges(request: TrufosRequest) {
    const { draft, dirPath } = await this.undraft(request);
    if (!draft) {
      return request;
    }
    logger.info('Discarding changes of request at', dirPath);

    // delete draft files
    await fs.unlink(path.join(dirPath, getInfoFileName(request.type, true)));
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
    const dirPath = this.getOrCreateDirPath(object);
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
      const filePath = path.join(this.getOrCreateDirPath(request), fileName);
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
    dirPath = normalizeDirPath(dirPath);
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
    await this.createGitIgnore(dirPath); // create .gitignore file
    return collection;
  }

  /**
   * Creates a collection .gitignore file in the specified directory path.
   * @param dirPath the directory path where the .gitignore file should be created
   */
  public async createGitIgnore(dirPath: string) {
    const filePath = path.join(dirPath, '.gitignore');
    logger.info(`Creating .gitignore file at`, filePath);
    await fs.writeFile(filePath, COLLECTION_GITIGNORE);
  }

  /**
   * Loads a collection and all of its children from the file system.
   * @param dirPath the directory path where the collection is located
   * @param recursive DEFAULT: true. Whether to load all children of the collection recursively
   * @returns the loaded collection
   */
  public async loadCollection(dirPath: string, recursive = true) {
    dirPath = normalizeDirPath(dirPath);
    logger.info('Loading collection at', dirPath);
    const type = 'collection' as const;
    const info = await this.readInfoFile(dirPath, type);

    this.idToPathMap.set(info.id, dirPath);
    const children = recursive ? await this.loadChildren(info.id, dirPath) : [];
    return fromCollectionInfoFile(info, dirPath, children);
  }

  private async loadRequest(parentId: string, dirPath: string): Promise<TrufosRequest> {
    const type = 'request' as const;
    const draft = await exists(path.join(dirPath, getInfoFileName(type, true)));
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
    if (type === 'folder' || (await exists(path.join(dirPath, getInfoFileName('folder'))))) {
      return (await this.loadFolder(parentId, dirPath)) as T;
    } else if (
      type === 'request' ||
      (await exists(path.join(dirPath, getInfoFileName('request')))) ||
      (await exists(path.join(dirPath, getInfoFileName('request', true))))
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
    const filePath = path.join(dirPath, getInfoFileName(type, draft));
    const info = assign(
      JSON.parse(await fs.readFile(filePath, 'utf8')) as InfoFile,
      await this.loadSecrets(dirPath, draft)
    );

    // check if the version is supported
    if (SemVer.parse(info.version).isNewerThan(VERSION)) {
      throw new Error(
        `The version of the loaded ${type} info file is newer than latest supported version ${VERSION}. Please update the application.`
      );
    }

    // potentially migrate the info file to the latest version
    return await migrateInfoFile(info, type, filePath);
  }

  private async loadSecrets(dirPath: string, draft = false): Promise<Partial<InfoFile>> {
    const filePath = path.join(dirPath, getSecretsFileName(draft));
    if (await exists(filePath)) {
      logger.debug('Loading secrets from', filePath);
      return JSON.parse(secretService.decrypt(await fs.readFile(filePath)));
    } else {
      return {};
    }
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

  private getOrCreateDirPath(object: TrufosObject) {
    if (isCollection(object)) {
      return object.dirPath;
    } else if (this.idToPathMap.has(object.id)) {
      return this.idToPathMap.get(object.id);
    } else {
      // object is not yet associated with any directory, must be a new object
      // we need to derive a new and unused directory path from the parent
      const parentDirPath = this.idToPathMap.get(object.parentId);
      if (!parentDirPath) {
        throw new Error(`Parent directory path for ${object.parentId} not found`);
      }

      const newDirName = this.getDirName(object);
      let newDirPath = path.join(parentDirPath, newDirName);

      // Check if the newDirPath is already taken, in that case we just append a number
      for (let i = 2; this.isDirPathTaken(newDirPath); i++) {
        newDirPath = path.join(parentDirPath, newDirName + '-' + i);
      }

      return newDirPath;
    }
  }

  private isDirPathTaken(targetDirPath: string) {
    return this.idToPathMap.values().some((path) => path === targetDirPath);
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

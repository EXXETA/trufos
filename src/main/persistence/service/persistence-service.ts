import { exists, isEmpty } from 'main/util/fs-util';
import { assign } from 'main/util/object-util';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isCollection, isFolder, isRequest, TrufosObject } from 'shim/objects';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import {
  RequestBodyType,
  TEXT_BODY_FILE_NAME,
  TextBody,
  TrufosRequest,
} from 'shim/objects/request';
import { generateDefaultCollection } from './default-collection';
import {
  CollectionInfoFile,
  createGitIgnore,
  extractSecrets,
  FolderInfoFile,
  fromCollectionInfoFile,
  fromFolderInfoFile,
  fromRequestInfoFile,
  GIT_IGNORE_FILE_NAME,
  InfoFile,
  RequestInfoFile,
  toInfoFile,
} from './info-files/latest';
import { migrateInfoFile } from './info-files/migrators';
import { SecretService } from './secret-service';
import { SettingsService } from './settings-service';
import { sanitizeTitle } from 'shim/fs';
import { DRAFT_DIR_NAME, SECRETS_FILE_NAME } from 'main/persistence/constants';

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
    if (!(await exists(path.join(dirPath, this.getInfoFileName('collection'))))) {
      logger.info('Creating default collection at', dirPath);
      const collection = generateDefaultCollection(dirPath);
      await this.saveCollection(collection, true);
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
   * Moves and/or reorders an item within the collection tree.
   * Handles filesystem moves when the parent changes and persists updated indices.
   * @param collection The root collection.
   * @param itemId The ID of the item to move.
   * @param newParentId The ID of the target parent (folder or collection).
   * @param newIndex The target index within the new parent's children.
   */
  public async reorderItem(
    collection: Collection,
    itemId: string,
    newParentId: string,
    newIndex: number
  ) {
    const found = this.findItemAndParent(collection, itemId);
    if (!found) throw new Error(`Item with ID ${itemId} not found in collection`);
    const { item, parent: oldParent } = found;

    const newParent = this.findNodeById(collection, newParentId) as Collection | Folder;
    if (!newParent) throw new Error(`Parent with ID ${newParentId} not found in collection`);

    const parentChanged = oldParent.id !== newParent.id;

    if (parentChanged) {
      await this.moveChild(item, oldParent, newParent);
      // moveChild pushes to end — move to the correct position
      newParent.children.pop();
      newParent.children.splice(newIndex, 0, item);
      item.parentId = newParentId;
    } else {
      const oldIndex = oldParent.children.findIndex((c: Folder | TrufosRequest) => c.id === itemId);
      oldParent.children.splice(oldIndex, 1);
      oldParent.children.splice(newIndex, 0, item);
    }

    await this.persistIndices(newParent);
    if (parentChanged) {
      await this.persistIndices(oldParent);
    }
  }

  /**
   * Renames a trufos object on the file system.
   * @param object trufos object to be renamed
   * @param title new title of the object
   */
  public async rename(object: TrufosObject, title: string) {
    object.title = title;

    // do not rename collection directories
    let newDirPath: string;
    if (!isCollection(object)) {
      const oldDirPath = this.getOrCreateDirPath(object);
      this.idToPathMap.delete(object.id); // force recreation of path after rename
      newDirPath = this.getOrCreateDirPath(object);

      if (oldDirPath !== newDirPath) {
        logger.info('Renaming object at', oldDirPath, 'to', newDirPath);
        await fs.rename(oldDirPath, newDirPath);
        this.idToPathMap.set(object.id, newDirPath);
        if (!isRequest(object)) {
          for (const child of object.children) {
            this.updatePathMapRecursively(child, newDirPath);
          }
        }
      } else {
        logger.info('Title changed but directory name unchanged for object', object.id);
      }
    } else {
      newDirPath = object.dirPath;
    }

    // Persist new title to the info file so that a reload reflects the change.
    // We only need to update the primary info file. Draft info files (hidden) represent unsaved changes and
    // will be updated when they are explicitly saved.
    await this.saveInfoFile(object, newDirPath);
  }

  /**
   * Creates or updates a request and optionally its text body on the file system.
   * @param request the request to be saved
   * @param textBody OPTIONAL: the text body of the request
   */
  public async saveRequest(request: TrufosRequest, textBody?: string) {
    const dirPath = this.getOrCreateDirPath(request, true);
    await this.saveInfoFile(request, dirPath);

    // save text body if provided
    if (textBody != null) {
      const body = request.body as TextBody;
      body.type = RequestBodyType.TEXT; // enforce type
      delete body.text; // only present once, if imported collection
      await fs.writeFile(path.join(dirPath, TEXT_BODY_FILE_NAME), textBody);
    } else if (await exists(path.join(dirPath, TEXT_BODY_FILE_NAME))) {
      await fs.unlink(path.join(dirPath, TEXT_BODY_FILE_NAME));
    }
    return request;
  }

  /**
   * Creates a copy of the given request and saves it to the file system with a new ID.
   *
   * @param request the request to copy.
   * @param addCopySuffix whether to add a '(Copy)' suffix to the request title.
   * @param newParentId the ID of the new parent folder.
   * @returns the copied request.
   */
  public async copyRequest(
    request: TrufosRequest,
    addCopySuffix: boolean = true,
    newParentId?: string
  ) {
    const requestCopy = structuredClone(request);
    requestCopy.id = null;
    requestCopy.title = addCopySuffix ? `${request.title} (Copy)` : request.title;
    requestCopy.parentId = newParentId ?? request.parentId;
    requestCopy.draft = false;

    await this.saveRequest(requestCopy);

    const requestDirPath = this.getOrCreateDirPath(request);
    const requestCopyDirPath = this.getOrCreateDirPath(requestCopy);
    const originalTextBodyPath = path.join(requestDirPath, TEXT_BODY_FILE_NAME);

    if (await exists(originalTextBodyPath)) {
      await fs.copyFile(originalTextBodyPath, path.join(requestCopyDirPath, TEXT_BODY_FILE_NAME));
    }

    const secretsFilePath = path.join(requestDirPath, SECRETS_FILE_NAME);

    if (await exists(secretsFilePath)) {
      await fs.copyFile(secretsFilePath, path.join(requestCopyDirPath, SECRETS_FILE_NAME));
    }

    return requestCopy;
  }

  /**
   * Saves the given collection to the file system.
   * @param collection the collection to save
   * @param recursive whether to save all children of the collection recursively. Default is false.
   */
  public async saveCollection(collection: Collection, recursive = false) {
    if (
      recursive &&
      ((await fs.mkdir(collection.dirPath, { recursive })) ||
        !(await exists(path.join(collection.dirPath, GIT_IGNORE_FILE_NAME))))
    ) {
      await createGitIgnore(collection.dirPath);
    }
    await this.saveInfoFile(collection, this.getOrCreateDirPath(collection));

    if (recursive) {
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
  }

  /**
   * Saves the given folder to the file system.
   * @param folder The folder to save.
   */
  public async saveFolder(folder: Folder) {
    await this.saveInfoFile(folder, this.getOrCreateDirPath(folder));
  }

  /**
   * Creates a copy of the given folder and all its children and saves them to the file system.
   * The copied folder and all its children will have new IDs.
   *
   * @param folder the folder to copy.
   * @param addCopySuffix whether to add a '(Copy)' suffix to the folder title. Defaults to true.
   * @param newParentId the ID of the new parent folder. Defaults to the current parent ID.
   * @returns the copied folder.
   */
  public async copyFolder(folder: Folder, addCopySuffix: boolean = true, newParentId?: string) {
    const folderCopy = structuredClone(folder);
    folderCopy.id = null;
    folderCopy.title = addCopySuffix ? `${folder.title} (Copy)` : folder.title;
    folderCopy.parentId = newParentId ?? folder.parentId;

    await this.saveFolder(folderCopy);

    for (const child of folder.children) {
      if (isFolder(child)) {
        await this.copyFolder(child, false, folderCopy.id);
      } else {
        await this.copyRequest(child, false, folderCopy.id);
      }
    }

    return folderCopy;
  }

  /**
   * Saves the information of a trufos object to the file system.
   * @param object the object to save
   * @param dirPath the directory path to save the object to
   */
  private async saveInfoFile(object: TrufosObject, dirPath: string) {
    logger.info('Saving object', object.id);
    if (!isCollection(object) && object.parentId == null) {
      throw new Error('Object must have a parent');
    }
    await fs.mkdir(dirPath, { recursive: true });

    // remove secrets from variables and save them separately
    object = structuredClone(object); // avoid modifying the original object
    await this.saveSecrets(object, dirPath);

    // write the info file
    await fs.writeFile(
      path.join(dirPath, this.getInfoFileName(object.type)),
      JSON.stringify(toInfoFile(object), null, 2)
    );
  }

  /**
   * Removes secrets from the given trufos object and saves them to a separate file.
   * @param object the trufos object to extract secrets from
   * @param dirPath the directory path where the secrets should be saved
   */
  private async saveSecrets(object: TrufosObject, dirPath: string) {
    const filePath = path.join(dirPath, SECRETS_FILE_NAME);
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
   * Overrides all information with the draft information. This does not write
   * any information to the file system. This only overrides the information
   * file with the draft information file.
   *
   * @param request the request to save the draft of
   */
  public async saveChanges(request: TrufosRequest) {
    const dirPath = this.getOrCreateDirPath(request);
    if (await this.hasDraft(dirPath)) {
      logger.info('Saving changes of request at', dirPath);
      const draftDirPath = this.getDraftDirPath(dirPath);

      // move all files from draft dir to original dir
      const filesToDelete = new Set([SECRETS_FILE_NAME, TEXT_BODY_FILE_NAME]);
      const filesToMove = await fs.readdir(draftDirPath);
      filesToMove.forEach((file) => filesToDelete.delete(file));
      await Promise.all(
        filesToMove.map((file) =>
          fs.rename(path.join(draftDirPath, file), path.join(dirPath, file))
        )
      );

      // delete files that exist in the original dir but not in the draft dir
      for (const file of filesToDelete) {
        if (await exists(path.join(dirPath, file))) {
          await fs.unlink(path.join(dirPath, file));
        }
      }

      // delete draft dir
      await fs.rmdir(draftDirPath);
    }

    request.draft = false;
    return request;
  }

  /**
   * Discards all draft information.
   * @param request the request to discard the draft of
   */
  public async discardChanges(request: TrufosRequest) {
    const dirPath = this.getOrCreateDirPath(request);
    if (!request.draft) {
      return request;
    }
    logger.info('Discarding changes of request at', dirPath);

    // delete draft files
    await fs.rmdir(this.getDraftDirPath(dirPath), { recursive: true });
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
      let dirPath = this.getOrCreateDirPath(request);
      if (request.draft) dirPath = this.getDraftDirPath(dirPath);
      const filePath = path.join(dirPath, TEXT_BODY_FILE_NAME);
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
    dirPath = this.normalizeDirPath(dirPath);
    logger.info('Creating new collection at', dirPath);
    if (!isEmpty(dirPath)) {
      throw new Error('Directory is not empty');
    }

    const collection: Collection = {
      id: null,
      title,
      type: 'collection',
      isDefault: false,
      dirPath,
      variables: {},
      environments: {},
      children: [],
    };
    await this.saveCollection(collection); // save collection file
    await createGitIgnore(dirPath); // create .gitignore file
    return collection;
  }

  /**
   * Loads a collection and all of its children from the file system.
   * @param dirPath the directory path where the collection is located
   * @param recursive DEFAULT: true. Whether to load all children of the collection recursively
   * @returns the loaded collection
   */
  public async loadCollection(dirPath: string, recursive = true) {
    dirPath = this.normalizeDirPath(dirPath);
    logger.info('Loading collection at', dirPath);
    const type = 'collection' as const;
    const info = await this.readInfoFile(dirPath, type);

    this.idToPathMap.set(info.id, dirPath);
    const children = recursive ? await this.loadChildren(info.id, dirPath) : [];
    return fromCollectionInfoFile(info, dirPath, children);
  }

  private async loadRequest(
    parentId: string,
    dirPath: string,
    draft?: boolean
  ): Promise<TrufosRequest> {
    const type = 'request' as const;
    draft ??= await exists(path.join(this.getDraftDirPath(dirPath), this.getInfoFileName(type)));
    const info = await this.readInfoFile(draft ? this.getDraftDirPath(dirPath) : dirPath, type);
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
      if (!node.isDirectory() || node.name === DRAFT_DIR_NAME) {
        continue;
      }

      const child = await this.load(parentId, path.join(parentDirPath, node.name));
      if (child != null) {
        children.push(child);
      }
    }

    return children.sort(
      (a, b) => (a.index ?? Number.POSITIVE_INFINITY) - (b.index ?? Number.POSITIVE_INFINITY)
    );
  }

  private async load<T extends TrufosRequest | Folder>(
    parentId: string,
    dirPath: string,
    type?: T['type']
  ): Promise<T> {
    if (type === 'folder' || (await exists(path.join(dirPath, this.getInfoFileName('folder'))))) {
      return (await this.loadFolder(parentId, dirPath)) as T;
    } else if (
      type === 'request' ||
      (await exists(path.join(dirPath, this.getInfoFileName('request')))) ||
      (await exists(path.join(this.getDraftDirPath(dirPath), this.getInfoFileName('request'))))
    ) {
      return (await this.loadRequest(parentId, dirPath)) as T;
    }
  }

  private readInfoFile(dirPath: string, type: Collection['type']): Promise<CollectionInfoFile>;
  private readInfoFile(dirPath: string, type: Folder['type']): Promise<FolderInfoFile>;
  private readInfoFile(dirPath: string, type: TrufosRequest['type']): Promise<RequestInfoFile>;

  private async readInfoFile<T extends TrufosObject>(dirPath: string, type: T['type']) {
    const filePath = path.join(dirPath, this.getInfoFileName(type));
    const info = assign(
      JSON.parse(await fs.readFile(filePath, 'utf8')) as InfoFile,
      await this.loadSecrets(dirPath)
    );
    try {
      const latest = await migrateInfoFile(info, type, filePath); // (potentially) migrate the info file to the latest version
      await InfoFile.parseAsync(latest); // validate the info file
      return latest;
    } catch (e) {
      throw new Error(`Failed to load ${type} info file at "${filePath}":`, { cause: e });
    }
  }

  private async loadSecrets(dirPath: string): Promise<Partial<InfoFile>> {
    const filePath = path.join(dirPath, SECRETS_FILE_NAME);
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

  /**
   * Gets the directory path of the given object. If the object is not yet associated with a directory,
   * a new directory path is derived from the parent directory and the object's title.
   * @param object the trufos object to get the directory path for
   * @param respectDraft whether to return the draft directory path for requests with draft status
   * @returns the directory path of the object
   */
  private getOrCreateDirPath(object: TrufosObject, respectDraft = false) {
    object.id ??= randomUUID();
    let dirPath: string;

    if (this.idToPathMap.has(object.id)) {
      dirPath = this.idToPathMap.get(object.id);
    } else if (isCollection(object)) {
      dirPath = object.dirPath;
      this.idToPathMap.set(object.id, dirPath);
    } else {
      // object is not yet associated with any directory, must be a new object
      // we need to derive a new and unused directory path from the parent
      const parentDirPath = this.idToPathMap.get(object.parentId);
      if (!parentDirPath) {
        throw new Error(`Parent directory path for ${object.parentId} not found`);
      }

      const newDirName = this.getDirName(object);
      dirPath = path.join(parentDirPath, newDirName);

      // check if the dir path is already taken, in that case we just append a number
      for (let i = 2; this.isDirPathTaken(dirPath); i++) {
        dirPath = path.join(parentDirPath, newDirName + '-' + i);
      }
      this.idToPathMap.set(object.id, dirPath);
    }

    // check if we need to return the draft dir path
    if (respectDraft && isRequest(object) && object.draft) dirPath = this.getDraftDirPath(dirPath);
    return dirPath;
  }

  /**
   * Gets the info file name for a given trufos object type.
   * @param type the type of the trufos object
   * @returns the info file name
   */
  getInfoFileName(type: TrufosObject['type']) {
    return `${type}.json`;
  }

  private isDirPathTaken(targetDirPath: string) {
    return this.idToPathMap.values().some((path) => path === targetDirPath);
  }

  private getDirName(object: TrufosObject) {
    return sanitizeTitle(object.title);
  }

  /**
   * Returns true if the given directory path to a trufos item has a draft. This is the case when there's a `.draft` subdirectory.
   * @param dirPath the directory to the trufos object
   * @returns true if the given directory has a draft
   */
  private async hasDraft(dirPath: string) {
    return await exists(this.getDraftDirPath(dirPath));
  }

  private getDraftDirPath(dirPath: string) {
    return path.join(dirPath, DRAFT_DIR_NAME);
  }

  private normalizeDirPath(dirPath: string) {
    dirPath = path.normalize(dirPath);
    if (dirPath.endsWith(path.sep)) {
      dirPath = dirPath.slice(0, -1);
    }
    return dirPath;
  }

  private findItemAndParent(
    node: Collection | Folder,
    itemId: string
  ): { item: Folder | TrufosRequest; parent: Collection | Folder } | null {
    for (const child of node.children) {
      if (child.id === itemId) return { item: child, parent: node };
      if (isFolder(child)) {
        const result = this.findItemAndParent(child, itemId);
        if (result) return result;
      }
    }
    return null;
  }

  public findNodeById(node: Collection | Folder, id: string): Collection | Folder | null {
    if (node.id === id) return node;
    for (const child of node.children) {
      if (isFolder(child)) {
        const result = this.findNodeById(child, id);
        if (result) return result;
      }
    }
    return null;
  }

  public async persistIndices(parent: Collection | Folder) {
    for (let i = 0; i < parent.children.length; i++) {
      parent.children[i].index = i;
      await this.saveInfoFile(parent.children[i], this.getOrCreateDirPath(parent.children[i]));
    }
  }
}

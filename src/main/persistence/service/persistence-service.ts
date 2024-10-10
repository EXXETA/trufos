import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { CollectionInfoFile, FolderInfoFile, RequestInfoFile, toInfoFile } from './info-files';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import {
  DRAFT_TEXT_BODY_FILE_NAME,
  RequestBodyType,
  RufusRequest,
  TEXT_BODY_FILE_NAME,
  TextBody
} from 'shim/objects/request';
import { exists, USER_DATA_DIR } from 'main/util/fs-util';
import { isCollection, isFolder, isRequest, RufusObject } from 'shim/objects/object';
import { generateDefaultCollection } from './default-collection';
import { Readable } from 'stream';

/**
 * This service is responsible for persisting and loading collections, folders, and requests
 * to and from the file system.
 */
export class PersistenceService {
  private static readonly DEFAULT_COLLECTION_DIR = path.join(
    USER_DATA_DIR,
    'default-collection'
  );

  public static readonly instance = new PersistenceService();

  private idToPathMap: Map<string, string> = new Map();

  /**
   * Loads the default collection into memory.
   * @returns the default collection
   */
  public async loadDefaultCollection() {
    const dirPath = PersistenceService.DEFAULT_COLLECTION_DIR;
    if (await exists(path.join(dirPath, 'collection.json'))) {
      return await this.loadCollection(dirPath);
    }

    console.info('Creating default collection at', dirPath);
    const collection = generateDefaultCollection(dirPath);
    await this.save(collection);
    return collection;
  }

  /**
   * Moves a child object from one parent to another on the file system.
   * @param child the child object that gets moved
   * @param oldParent the parent object the child is currently in
   * @param newParent the parent object the child gets moved to
   */
  public async moveChild(
    child: Folder | RufusRequest,
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
   * Renames a rufus object on the file system.
   * @param object rufus object to be renamed
   * @param newTitle new title of the object
   */
  public async rename(object: RufusObject, newTitle: string) {
    const oldDirPath = this.getDirPath(object);
    const parentDirPath = path.dirname(oldDirPath);
    const newDirName = this.getDirName(object);
    const newDirPath = path.join(parentDirPath, newDirName);

    await fs.rename(oldDirPath, newDirPath);

    object.title = newTitle;
    this.idToPathMap.set(object.id, newDirPath);

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
  public save(request: RufusRequest, textBody?: string): Promise<void>;

  /**
   * Creates or updates a rufus object on the file system.
   * @param object rufus object to be saved
   */
  public save(object: RufusObject): Promise<void>;

  public async save(object: RufusObject, textBody?: string) {
    const dirPath = this.getDirPath(object);
    const infoFileContents = toInfoFile(object);
    const infoFilePath = path.join(dirPath, `${object.draft ? '~' : ''}${object.type}.json`);

    // check if object is new
    if (object.id == null) {
      object.id = uuidv4();
    }
    if (!(await exists(dirPath))) {
      await fs.mkdir(dirPath);
    }

    await fs.writeFile(infoFilePath, JSON.stringify(infoFileContents, null, 2));
    this.idToPathMap.set(object.id, dirPath);

    // save text body if it exists
    if (isRequest(object)) {
      if (textBody != null) {
        const body = object.body as TextBody;
        body.type = RequestBodyType.TEXT; // enforce type
        delete body.text; // remove text body from request body
        const fileName = object.draft ? DRAFT_TEXT_BODY_FILE_NAME : TEXT_BODY_FILE_NAME;
        await fs.writeFile(path.join(dirPath, fileName), textBody);
      } else if (await exists(path.join(dirPath, TEXT_BODY_FILE_NAME))) {
        await fs.unlink(path.join(dirPath, TEXT_BODY_FILE_NAME));
      }
    }

    if (!isRequest(object)) {
      for (const child of object.children) {
        await this.save(child);
      }
    }
  }

  /**
   * Checks if a draft exists for the given object and returns the draft information.
   * Also sets the draft flag of the object to false.
   * @param object the object to mark as not a draft
   */
  private async undraft(object: RufusObject) {
    object.draft = false;
    const infoFileName = object.type + '.json';
    const dirPath = this.getDirPath(object);
    if (!await exists(path.join(dirPath, '~' + infoFileName))) {
      console.debug('Object at', dirPath, 'is not a draft');
      return { draft: false };
    }

    console.debug('Object at', dirPath, 'is a draft');
    return { draft: true, dirPath, infoFileName };
  }

  /**
   * Overrides all information with the draft information. This does not write
   * any information to the file system. This only overrides the information
   * file with the draft information file.
   *
   * @param object the object to save the draft of
   */
  public async saveChanges<T extends RufusObject>(object: T) {
    const { draft, dirPath, infoFileName } = await this.undraft(object);
    if (draft) {
      console.info('Saving changes of object at', dirPath);
      await fs.rename(path.join(dirPath, '~' + infoFileName), path.join(dirPath, infoFileName));
      if (isRequest(object)) {
        const draftBodyFilePath = path.join(dirPath, DRAFT_TEXT_BODY_FILE_NAME);
        const bodyFilePath = path.join(dirPath, TEXT_BODY_FILE_NAME);
        if (await exists(draftBodyFilePath)) {
          await fs.rename(draftBodyFilePath, bodyFilePath);
        } else if (await exists(bodyFilePath)) {
          await fs.unlink(bodyFilePath);
        }
      }
    }

    return object;
  }

  /**
   * Discards all draft information.
   * @param object the object to discard the draft of
   */
  public async discardChanges<T extends RufusObject>(object: T) {
    const { draft, dirPath, infoFileName } = await this.undraft(object);
    if (!draft) {
      return object;
    }
    console.info('Discarding changes of object at', dirPath);

    // delete draft files
    await fs.unlink(path.join(dirPath, '~' + infoFileName));
    if (isRequest(object) && await exists(path.join(dirPath, DRAFT_TEXT_BODY_FILE_NAME))) {
      await fs.unlink(path.join(dirPath, DRAFT_TEXT_BODY_FILE_NAME));
    }

    return await this.reload(object);
  }

  /**
   * Deletes an object and all of its children from the file system. Also removes
   * the object(s) from the path map.
   * @param object the object to delete
   */
  public async delete(object: RufusObject) {
    const dirPath = this.getDirPath(object);
    console.log('Deleting object at', dirPath);

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
   * @returns the text body of the request if it exists
   */
  public async loadTextBodyOfRequest(request: RufusRequest) {
    console.log('Loading text body of request', request.id);
    if (request.body.type === RequestBodyType.TEXT) {
      if (request.body.text != null) {
        return Readable.from([request.body.text]);
      }

      const fileName = request.draft ? DRAFT_TEXT_BODY_FILE_NAME : TEXT_BODY_FILE_NAME;
      const filePath = path.join(this.getDirPath(request), fileName);
      if (await exists(filePath)) {
        return createReadStream(filePath);
      }
    }
  }

  private loadInfoFile(dirPath: string, type: 'request'): Promise<[RequestInfoFile, boolean]>;
  private loadInfoFile(dirPath: string, type: 'folder'): Promise<[FolderInfoFile, boolean]>;
  private loadInfoFile(dirPath: string, type: 'collection'): Promise<[CollectionInfoFile, boolean]>;

  private async loadInfoFile(dirPath: string, type: RufusObject['type']) {
    let infoFileName = type + '.json';
    const draft = await exists(path.join(dirPath, '~' + infoFileName));
    if (draft) infoFileName = '~' + infoFileName;
    return [JSON.parse(await fs.readFile(path.join(dirPath, infoFileName), 'utf8')), draft];
  }

  /**
   * Loads a collection and all of its children from the file system.
   * @param dirPath the directory path where the collection is located
   * @returns the loaded collection
   */
  public async loadCollection(dirPath: string): Promise<Collection> {
    const type = 'collection' as const;
    const [infoFileContents, draft] = await this.loadInfoFile(dirPath, type);
    delete infoFileContents.version;
    const id = uuidv4();
    this.idToPathMap.set(id, dirPath);
    const children = await this.loadChildren(id, dirPath);
    return Object.assign(infoFileContents, {
      id,
      type,
      dirPath,
      children
    });
  }

  private async loadRequest(
    parentId: string,
    dirPath: string
  ): Promise<RufusRequest> {
    const type = 'request' as const;
    const [infoFileContents, draft] = await this.loadInfoFile(dirPath, type);
    delete infoFileContents.version;
    const id = uuidv4();
    this.idToPathMap.set(id, dirPath);

    return Object.assign(infoFileContents, {
      id,
      parentId,
      type,
      draft
    });
  }

  private async loadFolder(parentId: string, dirPath: string): Promise<Folder> {
    const type = 'folder' as const;
    const [infoFileContents, draft] = await this.loadInfoFile(dirPath, type);
    delete infoFileContents.version;
    const id = uuidv4();
    this.idToPathMap.set(id, dirPath);
    const children = await this.loadChildren(id, dirPath);
    return Object.assign(infoFileContents, {
      id,
      parentId,
      type,
      children
    });
  }

  private async loadChildren(
    parentId: string,
    parentDirPath: string
  ): Promise<(Folder | RufusRequest)[]> {
    const children: (Folder | RufusRequest)[] = [];

    for (const node of await fs.readdir(parentDirPath, {
      withFileTypes: true
    })) {
      if (!node.isDirectory()) {
        continue;
      }

      children.push(await this.load(parentId, path.join(parentDirPath, node.name)));
    }

    return children;
  }

  private async reload<T extends RufusObject>(object: T) {
    if (isCollection(object)) {
      return await this.loadCollection(object.dirPath) as T;
    } else {
      return await this.load(object.parentId, this.getDirPath(object), object.type) as T;
    }
  }

  private async load<T extends RufusRequest | Folder>(parentId: string, dirPath: string, type?: T['type']): Promise<T> {
    if (type === 'folder' || await exists(path.join(dirPath, 'folder.json'))) {
      return await this.loadFolder(parentId, dirPath) as T;
    } else if (type === 'request' || await exists(path.join(dirPath, 'request.json'))) {
      return await this.loadRequest(parentId, dirPath) as T;
    }

    throw new Error(`Could not determine type of object at "${dirPath}"`);
  }

  private updatePathMapRecursively(
    child: Folder | RufusRequest,
    newParentDirPath: string
  ) {
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

  private getDirPath(object: RufusObject) {
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

  private getDirName(object: RufusObject): string {
    return this.sanitizeTitle(object.title);
  }

  private sanitizeTitle(title: string): string {
    return title
    .toLowerCase()
    .replace(/\s/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  }
}

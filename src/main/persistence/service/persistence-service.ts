import { exists, isEmpty, readFileLimited } from 'main/util/fs-util';
import { assign } from 'main/util/object-util';
import { randomUUID } from 'node:crypto';
import { createReadStream, ReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { z } from 'zod';
import { TrufosObject } from 'shim/objects';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import {
  getInlineTextBody,
  RequestBodyType,
  TEXT_BODY_FILE_NAME,
  TrufosRequest,
} from 'shim/objects/request';
import type { CollectionInfo, FolderInfo } from 'shim/collection-model';
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
import { sanitizeTitle, uniqueName } from 'shim/string';
import {
  DRAFT_DIR_NAME,
  getInfoFileName,
  getScriptFileName,
  ORDER_FILE_NAME,
  OrderFile,
  SECRETS_FILE_NAME,
} from 'main/persistence/constants';
import { ScriptType } from 'shim';
import {
  CollectionSnapshot,
  FolderSnapshot,
  regenerateIds,
  RequestSnapshot,
  SnapshotChild,
} from './snapshot';

const secretService = SecretService.instance;

const INFO_FILE_SCHEMAS = {
  collection: CollectionInfoFile,
  folder: FolderInfoFile,
  request: RequestInfoFile,
} as const satisfies Record<TrufosObject['type'], z.ZodType<InfoFile>>;

/**
 * An object that has a directory of its own. Collections and folders may come with or without
 * their children, which are never needed to persist the object itself.
 */
type PersistedObject = CollectionInfo | FolderInfo | TrufosRequest;

/**
 * This service is responsible for persisting and loading collections, folders, and requests
 * to and from the file system. The open collection is owned by the `CollectionStateService`,
 * which calls this service to persist its changes.
 *
 * Objects given to this service are never modified, as they may be frozen.
 */
export class PersistenceService {
  public static readonly instance = new PersistenceService();

  private readonly idToPathMap: Map<string, string> = new Map();

  /**
   * Creates the default collection if it does not exist.
   */
  public async createDefaultCollectionIfNotExists(): Promise<void> {
    const dirPath = SettingsService.DEFAULT_COLLECTION_DIR;
    if (!(await exists(path.join(dirPath, this.getInfoFileName('collection'))))) {
      logger.info('Creating default collection at', dirPath);
      const collection = generateDefaultCollection(dirPath);
      await this.saveCollection(collection, true);
    }
  }

  /**
   * Moves a folder or request into another parent on the file system. The paths of all its
   * descendants are updated as well. The order files of both parents are not touched, see
   * {@link saveOrder}.
   * @param id the ID of the folder or request to move
   * @param newParentId the ID of the collection or folder to move it into
   */
  public async move(id: string, newParentId: string): Promise<void> {
    const oldDirPath = this.getDirPath(id);
    const newParentDirPath = this.getDirPath(newParentId);
    if (path.dirname(oldDirPath) === newParentDirPath) {
      logger.info('Object', id, 'already is in parent', newParentId);
      return;
    }

    // keep the directory name the object already has, suffixing it if the new parent holds a
    // sibling with the same name — renaming onto an existing directory would fail or replace it
    const dirName = uniqueName(path.basename(oldDirPath), (name) =>
      this.isDirPathTaken(path.join(newParentDirPath, name))
    );
    const newDirPath = path.join(newParentDirPath, dirName);

    logger.info(`Moving object ${id} from ${oldDirPath} to ${newDirPath}`);
    await fs.rename(oldDirPath, newDirPath);
    this.replacePathPrefix(oldDirPath, newDirPath);
  }

  /**
   * Renames a folder or request on the file system. The directory is renamed to match the new
   * title, unless the sanitized title stays the same.
   * @param node the folder or request to rename
   * @param title new title of the object
   */
  public async rename(node: FolderInfo | TrufosRequest, title: string): Promise<void> {
    const oldDirPath = this.getDirPath(node.id);
    const parentDirPath = path.dirname(oldDirPath);
    const dirName = uniqueName(sanitizeTitle(title), (name) => {
      const dirPath = path.join(parentDirPath, name);
      return dirPath !== oldDirPath && this.isDirPathTaken(dirPath);
    });
    const newDirPath = path.join(parentDirPath, dirName);

    if (newDirPath !== oldDirPath) {
      logger.info('Renaming object at', oldDirPath, 'to', newDirPath);
      await fs.rename(oldDirPath, newDirPath);
      this.replacePathPrefix(oldDirPath, newDirPath);
    } else {
      logger.info('Title changed but directory name unchanged for object', node.id);
    }

    if (node.type === 'request') {
      // The request may have a draft, so only the title is patched into its info files. Writing
      // the whole object would turn the draft into its saved state.
      const infoFileName = this.getInfoFileName('request');
      for (const dirPath of [newDirPath, this.getDraftDirPath(newDirPath)]) {
        const infoFilePath = path.join(dirPath, infoFileName);
        if (await exists(infoFilePath)) {
          const info = JSON.parse(await readFileLimited(infoFilePath, 'utf8'));
          await this.writeJson(infoFilePath, { ...info, title });
        }
      }
    } else {
      await this.saveInfoFile({ ...node, title }, newDirPath);
    }
  }

  /**
   * Writes the info file (and secrets) of a request. A request with a draft is written into its
   * draft directory. The text body and scripts are not touched.
   * @param request the request to save
   */
  public async saveRequestInfo(request: TrufosRequest): Promise<void> {
    await this.saveInfoFile(request, this.getOrCreateDirPath(request, true));
  }

  /**
   * Creates the draft directory of a request. The saved text body and scripts are copied into it,
   * so the draft directory is always complete. Then the draft info file is written.
   * @param request the request in its draft state
   */
  public async createDraft(request: TrufosRequest): Promise<void> {
    const dirPath = this.getOrCreateDirPath(request);
    const draftDirPath = this.getDraftDirPath(dirPath);
    logger.info('Creating draft of request at', dirPath);
    await fs.mkdir(draftDirPath, { recursive: true });
    await this.copyContentFiles(dirPath, draftDirPath);
    await this.saveInfoFile(request, draftDirPath);
  }

  /**
   * Writes the text body of a request. A request with a draft is written into its draft directory.
   *
   * The body is written to a temporary file that then replaces the body file, so a request that is
   * being sent keeps streaming the body it was sent with. The temporary file has to be next to the
   * body file, as only a file of the same volume can replace it. It is a dotfile, and one left
   * behind by a crash is deleted with the draft directory or when the request is saved.
   *
   * @param request the request to write the text body of
   * @param text the text body
   */
  public async writeTextBody(request: TrufosRequest, text: string): Promise<void> {
    const dirPath = this.getOrCreateDirPath(request, true);
    await fs.mkdir(dirPath, { recursive: true });
    const tempFilePath = path.join(dirPath, `.${TEXT_BODY_FILE_NAME}.${randomUUID()}.tmp`);
    try {
      await fs.writeFile(tempFilePath, text);
      await fs.rename(tempFilePath, path.join(dirPath, TEXT_BODY_FILE_NAME));
    } catch (error) {
      await fs.rm(tempFilePath, { force: true });
      throw error;
    }
  }

  /**
   * Writes a script of a request. A request with a draft is written into its draft directory.
   * @param request the request to write the script of
   * @param type the type of the script
   * @param script the source code of the script
   */
  public async saveScript(request: TrufosRequest, type: ScriptType, script: string): Promise<void> {
    const filePath = this.getScriptFilePath(request, type);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, script);
  }

  /**
   * Opens a script of a request, from its draft directory if it has a draft.
   * @param request the request to load the script of
   * @param type the type of the script
   * @returns the script, or undefined if the request has no such script
   */
  public async loadScript(
    request: TrufosRequest,
    type: ScriptType
  ): Promise<ReadStream | undefined> {
    const filePath = this.getScriptFilePath(request, type);
    if (await exists(filePath)) {
      return createReadStream(filePath, 'utf-8');
    }
  }

  /**
   * Copies the text body and scripts of a request into the directory of its copy. They are taken
   * from the current state of the source, i.e. from its draft directory if it has a draft.
   * @param source the request that was copied
   * @param copy the copy of the request
   */
  public async copyRequestFiles(source: TrufosRequest, copy: TrufosRequest): Promise<void> {
    const targetDirPath = this.getOrCreateDirPath(copy, true);
    await fs.mkdir(targetDirPath, { recursive: true });
    await this.copyContentFiles(this.getOrCreateDirPath(source, true), targetDirPath);
  }

  /**
   * Saves the given collection to the file system.
   * @param collection the collection to save
   * @param recursive whether to save all children of the collection recursively. Default is false.
   */
  public async saveCollection(collection: Collection, recursive = false): Promise<void> {
    if (
      recursive &&
      ((await fs.mkdir(collection.dirPath, { recursive })) ||
        !(await exists(path.join(collection.dirPath, GIT_IGNORE_FILE_NAME))))
    ) {
      await createGitIgnore(collection.dirPath);
    }
    await this.saveCollectionInfo(collection);

    if (recursive) {
      const queue: (Folder | TrufosRequest)[] = [...collection.children];
      for (let child = queue.shift(); child != null; child = queue.shift()) {
        if (child.type === 'request') {
          await this.saveRequestInfo(child);
          // importers deliver the body inline, because they never touch the file system themselves
          const textBody = getInlineTextBody(child);
          if (textBody != null) await this.writeTextBody(child, textBody);
        } else {
          await this.saveFolder(child);
          queue.push(...child.children);
        }
      }
    }
  }

  /**
   * Saves the info file (and secrets) of the given collection. Its children are not touched.
   * @param collection the collection to save
   */
  public async saveCollectionInfo(collection: CollectionInfo): Promise<void> {
    await this.saveInfoFile(collection, this.getOrCreateDirPath(collection));
  }

  /**
   * Saves the info file of the given folder. Its children are not touched.
   * @param folder The folder to save.
   */
  public async saveFolder(folder: FolderInfo): Promise<void> {
    await this.saveInfoFile(folder, this.getOrCreateDirPath(folder));
  }

  /**
   * Writes the order of the children of a collection or folder.
   * @param parentId the ID of the collection or folder
   * @param childIds the IDs of all its children, in order
   */
  public async saveOrder(parentId: string, childIds: readonly string[]): Promise<void> {
    await this.writeJson(path.join(this.getDirPath(parentId), ORDER_FILE_NAME), childIds);
  }

  /**
   * Saves the information of a trufos object to the file system.
   * @param object the object to save
   * @param dirPath the directory path to save the object to
   */
  private async saveInfoFile(object: PersistedObject, dirPath: string) {
    logger.info('Saving object', object.id);
    await fs.mkdir(dirPath, { recursive: true });

    // the secrets are removed from a copy, the given object may be frozen
    const copy = toTrufosObject(object);
    await this.saveSecrets(copy, dirPath);

    // write the info file
    await this.writeJson(path.join(dirPath, this.getInfoFileName(copy.type)), toInfoFile(copy));
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
   * Turns the draft of a request into its saved state by replacing the saved files with the files
   * of the draft directory. The draft directory is complete: it gets the body and scripts when it
   * is created and the info file and secrets with every write.
   * @param request the request to save the draft of
   */
  public async saveChanges(request: TrufosRequest): Promise<void> {
    const dirPath = this.getDirPath(request.id);
    if (!(await this.hasDraft(dirPath))) return;
    logger.info('Saving changes of request at', dirPath);
    const draftDirPath = this.getDraftDirPath(dirPath);

    // delete the saved state, including files the draft no longer has
    const savedFiles = (await fs.readdir(dirPath)).filter((file) => file !== DRAFT_DIR_NAME);
    await Promise.all(
      savedFiles.map((file) => fs.rm(path.join(dirPath, file), { recursive: true, force: true }))
    );

    // move the draft into its place
    const draftFiles = await fs.readdir(draftDirPath);
    await Promise.all(
      draftFiles.map((file) => fs.rename(path.join(draftDirPath, file), path.join(dirPath, file)))
    );
    await fs.rm(draftDirPath, { recursive: true, force: true });
  }

  /**
   * Discards the draft of a request by deleting its draft directory. A request that was never
   * saved has nothing left afterwards, so its directory is deleted as well.
   * @param request the request to discard the draft of
   */
  public async discardChanges(request: TrufosRequest): Promise<void> {
    const dirPath = this.getDirPath(request.id);
    logger.info('Discarding changes of request at', dirPath);
    await fs.rm(this.getDraftDirPath(dirPath), { recursive: true, force: true });

    if (!(await exists(path.join(dirPath, this.getInfoFileName('request'))))) {
      this.removePathsUnder(dirPath);
      await fs.rm(dirPath, { recursive: true, force: true });
    }
  }

  /**
   * Deletes a folder (including its descendants) or a request from the file system and forgets
   * the paths of all of them. The order file of its parent is not touched, see {@link saveOrder}.
   * @param id the ID of the folder or request to delete
   */
  public async deleteNode(id: string): Promise<void> {
    const dirPath = this.getDirPath(id);
    logger.info('Deleting object at', dirPath);
    await fs.rm(dirPath, { recursive: true, force: true });
    this.removePathsUnder(dirPath);
  }

  /**
   * Loads the saved state of a request that has a draft.
   * @param id the ID of the request
   * @param parentId the ID of the parent of the request
   * @returns the saved state, or undefined if the request was never saved
   */
  public async loadSavedRequest(id: string, parentId: string): Promise<TrufosRequest | undefined> {
    const dirPath = this.getDirPath(id);
    if (!(await exists(path.join(dirPath, this.getInfoFileName('request'))))) return;
    return await this.loadRequest(parentId, dirPath, false);
  }

  /**
   * Loads the text body of a request from the file system.
   * @param request the request to load the text body for
   * @param encoding the encoding of the text body. Default is binary.
   * @returns the text body of the request if it exists
   */
  public async loadTextBodyOfRequest(
    request: TrufosRequest,
    encoding?: BufferEncoding
  ): Promise<ReadStream | undefined> {
    logger.info('Loading text body of request', request.id);
    if (request.body.type === RequestBodyType.TEXT) {
      const filePath = path.join(this.getOrCreateDirPath(request, true), TEXT_BODY_FILE_NAME);
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
    if ((await exists(dirPath)) && !(await isEmpty(dirPath))) {
      throw new Error('Directory is not empty');
    }

    const collection: Collection = {
      id: randomUUID(),
      title,
      type: 'collection',
      lastModified: Date.now(),
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
  public async loadCollection(dirPath: string, recursive = true): Promise<Collection> {
    dirPath = this.normalizeDirPath(dirPath);
    logger.info('Loading collection at', dirPath);
    const type = 'collection' as const;
    const info = await this.readInfoFile(dirPath, type);

    this.idToPathMap.set(info.id, dirPath);
    const children = recursive ? await this.loadChildren(info.id, dirPath) : [];

    const lastModified = await this.getInfoFileModificationTime(dirPath, type);
    return fromCollectionInfoFile(info, lastModified, dirPath, children);
  }

  /**
   * Creates a fully-hydrated, saved-only snapshot of the collection at the given directory.
   * Unlike {@link loadCollection}, drafts are excluded (the last saved state of each request is
   * used and never-saved draft-only requests are skipped), request bodies and scripts are exposed
   * through lazy streams, and the walk is fully detached from the persistence state (it does not
   * register anything in the ID-to-path mapping).
   *
   * @param dirPath the directory path where the collection is located
   * @param options.freshIds when true, all nodes get fresh IDs (see {@link regenerateIds}).
   *   Intended for cloning; exports preserve the original IDs.
   * @returns the collection snapshot
   */
  public async walkCollection(
    dirPath: string,
    options: { freshIds?: boolean } = {}
  ): Promise<CollectionSnapshot> {
    dirPath = this.normalizeDirPath(dirPath);
    logger.info('Walking collection at', dirPath);
    const type = 'collection' as const;
    const info = await this.readInfoFile(dirPath, type);
    const lastModified = await this.getInfoFileModificationTime(dirPath, type);
    const children = await this.walkChildren(info.id, dirPath);

    const snapshot = fromCollectionInfoFile(
      info,
      lastModified,
      dirPath,
      children
    ) as CollectionSnapshot;
    if (options.freshIds) regenerateIds(snapshot);
    return snapshot;
  }

  private async walkChildren(parentId: string, parentDirPath: string): Promise<SnapshotChild[]> {
    const nodes = (await fs.readdir(parentDirPath, { withFileTypes: true })).filter(
      (node) => node.isDirectory() && node.name !== DRAFT_DIR_NAME
    );

    // Promise.all() resolves by index, so the children keep their directory order regardless of
    // which of them finishes walking first
    const [children, order] = await Promise.all([
      Promise.all(
        nodes.map((node) => this.walkChild(parentId, path.join(parentDirPath, node.name)))
      ),
      this.loadOrderFile(parentDirPath),
    ]);

    return this.sortChildrenArray(
      children.filter((child) => child != null),
      order
    );
  }

  private async walkChild(
    parentId: string,
    childDirPath: string
  ): Promise<SnapshotChild | undefined> {
    if (await exists(path.join(childDirPath, getInfoFileName('folder')))) {
      const info = await this.readInfoFile(childDirPath, 'folder');
      const lastModified = await this.getInfoFileModificationTime(childDirPath, 'folder');
      const children = await this.walkChildren(info.id, childDirPath);
      return fromFolderInfoFile(info, lastModified, parentId, children) as FolderSnapshot;
    } else if (await exists(path.join(childDirPath, getInfoFileName('request')))) {
      // NOTE: draft-only (never saved) requests have no main request.json and are skipped here.
      const info = await this.readInfoFile(childDirPath, 'request');
      const lastModified = await this.getInfoFileModificationTime(childDirPath, 'request');
      const request = fromRequestInfoFile(info, lastModified, parentId, false);
      return this.createRequestSnapshot(request, childDirPath);
    }
    return undefined;
  }

  /**
   * Attaches the lazy content accessors to a loaded request. The closures capture the request's
   * directory directly, keeping the snapshot independent of the ID-to-path mapping.
   */
  private createRequestSnapshot(request: TrufosRequest, dirPath: string): RequestSnapshot {
    return Object.assign(request, {
      async getBodyContent() {
        const filePath = path.join(dirPath, TEXT_BODY_FILE_NAME);
        if (await exists(filePath)) return createReadStream(filePath);
        // inline body of a never saved collection (as bytes, like a file stream)
        const inlineTextBody = getInlineTextBody(request);
        if (inlineTextBody != null) return Readable.from(Buffer.from(inlineTextBody));
        return undefined;
      },
      async getScriptContent(type: ScriptType) {
        const filePath = path.join(dirPath, getScriptFileName(type));
        if (await exists(filePath)) return createReadStream(filePath);
        return undefined;
      },
    });
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

    const lastModified = await this.getInfoFileModificationTime(
      draft ? this.getDraftDirPath(dirPath) : dirPath,
      type
    );
    return fromRequestInfoFile(info, lastModified, parentId, draft);
  }

  private async loadFolder(parentId: string, dirPath: string): Promise<Folder> {
    const type = 'folder' as const;
    const info = await this.readInfoFile(dirPath, type);
    this.idToPathMap.set(info.id, dirPath);
    const children = await this.loadChildren(info.id, dirPath);

    const lastModified = await this.getInfoFileModificationTime(dirPath, type);
    return fromFolderInfoFile(info, lastModified, parentId, children);
  }

  private async getInfoFileModificationTime(
    dirPath: string,
    type: TrufosObject['type']
  ): Promise<number> {
    const infoFilePath = path.join(dirPath, this.getInfoFileName(type));
    const stats = await fs.stat(infoFilePath);
    return stats.mtimeMs;
  }

  private async loadChildren(
    parentId: string,
    parentDirPath: string
  ): Promise<(Folder | TrufosRequest)[]> {
    const nodes = (await fs.readdir(parentDirPath, { withFileTypes: true })).filter(
      (node) => node.isDirectory() && node.name !== DRAFT_DIR_NAME
    );

    // Promise.all() resolves by index, so the children keep their directory order regardless of
    // which of them finishes loading first
    const [children, order] = await Promise.all([
      Promise.all(nodes.map((node) => this.load(parentId, path.join(parentDirPath, node.name)))),
      this.loadOrderFile(parentDirPath),
    ]);

    return this.sortChildrenArray(
      children.filter((child) => child != null),
      order
    );
  }

  private sortChildrenArray<T extends { id: string }>(children: T[], order: string[]): T[] {
    const orderLookup = new Map(order.map((id, index) => [id, index]));
    return children.sort(
      (a, b) =>
        (orderLookup.get(a.id) ?? Number.POSITIVE_INFINITY) -
        (orderLookup.get(b.id) ?? Number.POSITIVE_INFINITY)
    );
  }

  private async loadOrderFile(dirPath: string): Promise<string[]> {
    const filePath = path.join(dirPath, ORDER_FILE_NAME);
    if (!(await exists(filePath))) {
      return [];
    }

    return await OrderFile.parseAsync(JSON.parse(await readFileLimited(filePath, 'utf8')));
  }

  private async load<T extends TrufosRequest | Folder>(
    parentId: string,
    dirPath: string,
    type?: T['type']
  ): Promise<T | undefined> {
    if (type === 'folder' || (await exists(path.join(dirPath, this.getInfoFileName('folder'))))) {
      return (await this.loadFolder(parentId, dirPath)) as T;
    } else if (
      type === 'request' ||
      (await exists(path.join(dirPath, this.getInfoFileName('request')))) ||
      (await exists(path.join(this.getDraftDirPath(dirPath), this.getInfoFileName('request'))))
    ) {
      return (await this.loadRequest(parentId, dirPath)) as T;
    }
    return undefined;
  }

  private readInfoFile(dirPath: string, type: Collection['type']): Promise<CollectionInfoFile>;
  private readInfoFile(dirPath: string, type: Folder['type']): Promise<FolderInfoFile>;
  private readInfoFile(dirPath: string, type: TrufosRequest['type']): Promise<RequestInfoFile>;

  private async readInfoFile<T extends TrufosObject>(
    dirPath: string,
    type: T['type']
  ): Promise<InfoFile> {
    const filePath = path.join(dirPath, this.getInfoFileName(type));
    try {
      const info = assign(
        JSON.parse(await readFileLimited(filePath, 'utf8')) as InfoFile,
        await this.loadSecrets(dirPath)
      );
      const latest = await migrateInfoFile(info, type, filePath); // (potentially) migrate the info file to the latest version
      return await INFO_FILE_SCHEMAS[type].parseAsync(latest); // validate against the schema of the expected type
    } catch (e) {
      throw new Error(`Failed to load ${type} info file at "${filePath}":`, { cause: e });
    }
  }

  private async loadSecrets(dirPath: string): Promise<Partial<InfoFile>> {
    const filePath = path.join(dirPath, SECRETS_FILE_NAME);
    if (await exists(filePath)) {
      logger.debug('Loading secrets from', filePath);
      return JSON.parse(secretService.decrypt(await readFileLimited(filePath)));
    } else {
      return {};
    }
  }

  /**
   * Gets the directory path of the given object. If the object is not yet associated with a directory,
   * a new directory path is derived from the parent directory and the object's title.
   * @param object the trufos object to get the directory path for
   * @param respectDraft whether to return the draft directory path for requests with draft status
   * @returns the directory path of the object
   */
  private getOrCreateDirPath(object: PersistedObject, respectDraft = false) {
    let dirPath = this.idToPathMap.get(object.id);

    if (dirPath != null) {
      // already associated with a directory
    } else if (object.type === 'collection') {
      dirPath = object.dirPath;
      this.idToPathMap.set(object.id, dirPath);
    } else {
      // object is not yet associated with any directory, must be a new object
      // we need to derive a new and unused directory path from the parent
      const parentDirPath = this.getDirPath(object.parentId);
      const dirName = uniqueName(sanitizeTitle(object.title), (name) =>
        this.isDirPathTaken(path.join(parentDirPath, name))
      );
      dirPath = path.join(parentDirPath, dirName);
      this.idToPathMap.set(object.id, dirPath);
    }

    // check if we need to return the draft dir path
    if (respectDraft && object.type === 'request' && object.draft) {
      dirPath = this.getDraftDirPath(dirPath);
    }
    return dirPath;
  }

  /**
   * Returns the directory path of an object that is already associated with a directory.
   * @param id the ID of the object
   * @throws Error if the object has no known directory
   */
  private getDirPath(id: string) {
    const dirPath = this.idToPathMap.get(id);
    if (dirPath == null) throw new Error(`Directory path for ${id} not found`);
    return dirPath;
  }

  /**
   * Updates the directory of every object at or below `oldDirPath` after it was moved or renamed.
   */
  private replacePathPrefix(oldDirPath: string, newDirPath: string) {
    for (const [id, dirPath] of this.idToPathMap) {
      if (isSameOrInside(dirPath, oldDirPath)) {
        this.idToPathMap.set(id, newDirPath + dirPath.slice(oldDirPath.length));
      }
    }
  }

  /** Forgets the directory of every object at or below the given directory after it was deleted. */
  private removePathsUnder(dirPath: string) {
    for (const [id, path] of this.idToPathMap) {
      if (isSameOrInside(path, dirPath)) this.idToPathMap.delete(id);
    }
  }

  /** Copies the text body and every script of a request from one directory into another. */
  private async copyContentFiles(sourceDirPath: string, targetDirPath: string) {
    const fileNames = [TEXT_BODY_FILE_NAME, ...Object.values(ScriptType).map(getScriptFileName)];
    for (const fileName of fileNames) {
      const filePath = path.join(sourceDirPath, fileName);
      if (await exists(filePath)) await fs.copyFile(filePath, path.join(targetDirPath, fileName));
    }
  }

  /**
   * Gets the info file name for a given trufos object type.
   * @param type the type of the trufos object
   * @returns the info file name
   */
  getInfoFileName(type: TrufosObject['type']): string {
    return getInfoFileName(type);
  }

  private getScriptFilePath(request: TrufosRequest, type: ScriptType) {
    return path.join(this.getOrCreateDirPath(request, true), getScriptFileName(type));
  }

  private isDirPathTaken(targetDirPath: string) {
    return this.idToPathMap.values().some((path) => path === targetDirPath);
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

  private async writeJson(filePath: string, value: unknown) {
    await fs.writeFile(filePath, JSON.stringify(value, null, 2));
  }
}

/** Returns true if `dirPath` is `parentDirPath` itself or a directory inside it. */
function isSameOrInside(dirPath: string, parentDirPath: string) {
  return dirPath === parentDirPath || dirPath.startsWith(parentDirPath + path.sep);
}

/**
 * Returns a mutable copy of the given object as a {@link TrufosObject}. Collections and folders
 * get no children, as only their info file is written.
 */
function toTrufosObject(object: PersistedObject): TrufosObject {
  const copy = structuredClone(object);
  return copy.type === 'request' ? copy : { ...copy, children: [] };
}

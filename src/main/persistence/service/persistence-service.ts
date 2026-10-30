import { exists, isEmpty, isSameOrInside, openFile, readFileLimited } from 'main/util/fs-util';
import { isErrnoException } from 'shim/error/errno';
import { assign } from 'main/util/object-util';
import { randomUUID } from 'node:crypto';
import { createReadStream, ReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { z } from 'zod';
import { TrufosObject } from 'shim/objects';
import { Collection, CollectionBase } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import {
  getInlineTextBody,
  RequestBodyType,
  TEXT_BODY_FILE_NAME,
  TrufosRequest,
} from 'shim/objects/request';
import type { CollectionInfo, FolderInfo } from 'shim/collection-model';
import { generateDefaultCollection } from './default-collection';
import { createGitIgnore, createGitIgnoreMatcher, ensureGitIgnore } from './git-ignore';
import {
  CollectionInfoFile,
  extractSecrets,
  FolderInfoFile,
  fromCollectionInfoFile,
  fromFolderInfoFile,
  fromRequestInfoFile,
  GIT_IGNORE_LINES,
  InfoFile,
  InfoObject,
  RequestInfoFile,
  toInfoFile,
} from './info-files/latest';
import { migrateInfoFile } from './info-files/migrators';
import { SecretService } from './secret-service';
import { StateService } from './state-service';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { sanitizeTitle, uniqueNameAsync } from 'shim/string';
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
const fileSystemService = FileSystemService.instance;

/** The files of a request that are not part of the request object: its text body and scripts. */
const CONTENT_FILE_NAMES: ReadonlySet<string> = new Set([
  TEXT_BODY_FILE_NAME,
  ...Object.values(ScriptType).map(getScriptFileName),
]);

/**
 * Checks whether a file of a collection is only written by the app: drafts, secrets and the
 * temporary files of atomic writes. The `.gitignore` of a collection excludes exactly these, so
 * git never changes them.
 * @param relativePath the path of the file relative to the collection directory
 */
export const isAppOwnedPath: (relativePath: string) => boolean =
  createGitIgnoreMatcher(GIT_IGNORE_LINES);

/**
 * Checks whether a file is a text body or a script of a request. These are not part of the request
 * objects, so a change to one of them does not change the collection.
 * @param filePath the path of the file
 */
export function isContentFile(filePath: string): boolean {
  return CONTENT_FILE_NAMES.has(path.basename(filePath));
}

/** The files of a request that are needed to send it, see {@link PersistenceService.openRequestFiles}. */
export interface RequestFiles {
  /** The opened text body, if the request has a text body that was ever written. */
  textBody?: Readable;
  /** The scripts of the request, by type. */
  scripts: Partial<Record<ScriptType, string>>;
}

const INFO_FILE_SCHEMAS = {
  collection: CollectionInfoFile,
  folder: FolderInfoFile,
  request: RequestInfoFile,
} as const satisfies Record<TrufosObject['type'], z.ZodType<InfoFile>>;

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
    const dirPath = StateService.DEFAULT_COLLECTION_DIR;
    if (!(await exists(path.join(dirPath, getInfoFileName('collection'))))) {
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
    const dirName = await uniqueNameAsync(path.basename(oldDirPath), (name) =>
      this.isDirPathTaken(path.join(newParentDirPath, name))
    );
    const newDirPath = path.join(newParentDirPath, dirName);

    logger.info(`Moving object ${id} from ${oldDirPath} to ${newDirPath}`);
    await fs.rename(oldDirPath, newDirPath);
    this.replacePathPrefix(oldDirPath, newDirPath);
  }

  /**
   * Renames a folder or request on the file system. The directory is renamed to match the new
   * title, unless the sanitized title stays the same. Then the info files are rewritten.
   * @param node the folder or request with its new title
   * @param savedRequest the saved state of a draft request, with the new title as well. Its info
   * file is rewritten, too.
   */
  public async rename(
    node: FolderInfo | TrufosRequest,
    savedRequest?: TrufosRequest
  ): Promise<void> {
    const oldDirPath = this.getDirPath(node.id);
    const parentDirPath = path.dirname(oldDirPath);
    const dirName = await uniqueNameAsync(sanitizeTitle(node.title), async (name) => {
      const dirPath = path.join(parentDirPath, name);
      return dirPath !== oldDirPath && (await this.isDirPathTaken(dirPath));
    });
    const newDirPath = path.join(parentDirPath, dirName);

    if (newDirPath !== oldDirPath) {
      logger.info('Renaming object at', oldDirPath, 'to', newDirPath);
      await fs.rename(oldDirPath, newDirPath);
      this.replacePathPrefix(oldDirPath, newDirPath);
    } else {
      logger.info('Title changed but directory name unchanged for object', node.id);
    }

    if (node.type === 'folder') {
      await this.saveFolder(node);
    } else {
      if (savedRequest != null) await this.saveRequestInfo(savedRequest);
      await this.saveRequestInfo(node);
    }
  }

  /**
   * Writes the info file (and secrets) of a request. A request with a draft is written into its
   * draft directory. The text body and scripts are not touched.
   * @param request the request to save
   */
  public async saveRequestInfo(request: TrufosRequest): Promise<void> {
    await this.saveInfoFile(request, await this.getOrCreateDirPath(request, true));
  }

  /**
   * Creates the draft directory of a request. The saved text body and scripts are copied into it,
   * so the draft directory is always complete. Then the draft info file is written.
   * @param request the request in its draft state
   */
  public async createDraft(request: TrufosRequest): Promise<void> {
    const dirPath = await this.getOrCreateDirPath(request);
    const draftDirPath = this.getDraftDirPath(dirPath);
    logger.info('Creating draft of request at', dirPath);
    await fs.mkdir(draftDirPath, { recursive: true });
    await this.copyContentFiles(dirPath, draftDirPath);
    await this.saveInfoFile(request, draftDirPath);
  }

  /**
   * Writes the text body of a request. A request with a draft is written into its draft directory.
   * The body file is replaced, see {@link FileSystemService.replaceFile}, so a request that is being sent keeps
   * streaming the body it was sent with.
   * @param request the request to write the text body of
   * @param text the text body
   */
  public async writeTextBody(request: TrufosRequest, text: string): Promise<void> {
    const dirPath = await this.getOrCreateDirPath(request, true);
    await fs.mkdir(dirPath, { recursive: true });
    await fileSystemService.replaceFile(path.join(dirPath, TEXT_BODY_FILE_NAME), text);
  }

  /**
   * Writes a script of a request. A request with a draft is written into its draft directory.
   * @param request the request to write the script of
   * @param type the type of the script
   * @param script the source code of the script
   */
  public async saveScript(request: TrufosRequest, type: ScriptType, script: string): Promise<void> {
    const filePath = await this.getScriptFilePath(request, type);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fileSystemService.replaceFile(filePath, script);
  }

  /**
   * Reads the scripts of a request and opens its text body, from its draft directory if it has a
   * draft. The caller has to close the text body.
   * @param request the request to open the files of
   */
  public async openRequestFiles(request: TrufosRequest): Promise<RequestFiles> {
    const scripts: RequestFiles['scripts'] = {};
    for (const type of Object.values(ScriptType)) {
      const stream = await this.loadScript(request, type);
      if (stream != null) scripts[type] = await text(stream);
    }
    // opened last, so nothing has to be closed if reading a script fails
    return { scripts, textBody: await this.loadTextBodyOfRequest(request) };
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
    const filePath = path.join(this.getRequestDirPath(request), getScriptFileName(type));
    return await openFile(filePath, 'utf-8');
  }

  /**
   * Copies the text body and scripts of a request into the directory of its copy. They are taken
   * from the current state of the source, i.e. from its draft directory if it has a draft.
   * @param source the request that was copied
   * @param copy the copy of the request
   */
  public async copyRequestFiles(source: TrufosRequest, copy: TrufosRequest): Promise<void> {
    const targetDirPath = await this.getOrCreateDirPath(copy, true);
    await fs.mkdir(targetDirPath, { recursive: true });
    await this.copyContentFiles(await this.getOrCreateDirPath(source, true), targetDirPath);
  }

  /**
   * Saves the given collection to the file system.
   * @param collection the collection to save
   * @param recursive whether to save all children of the collection recursively. Default is false.
   */
  public async saveCollection(collection: Collection, recursive = false): Promise<void> {
    if (recursive) {
      await fs.mkdir(collection.dirPath, { recursive });
      await ensureGitIgnore(collection.dirPath, GIT_IGNORE_LINES);
    }
    const { children, ...info } = collection;
    await this.saveCollectionInfo(info);

    if (recursive) {
      const queue: (Folder | TrufosRequest)[] = [...children];
      for (let child = queue.shift(); child != null; child = queue.shift()) {
        if (child.type === 'request') {
          await this.saveRequestInfo(child);
          // importers deliver the body inline, because they never touch the file system themselves
          const textBody = getInlineTextBody(child);
          if (textBody != null) await this.writeTextBody(child, textBody);
        } else {
          const { children: grandChildren, ...folder } = child;
          await this.saveFolder(folder);
          queue.push(...grandChildren);
        }
      }
    }
  }

  /**
   * Saves the info file (and secrets) of the given collection. Its children are not touched.
   * @param collection the collection to save
   */
  public async saveCollectionInfo(collection: CollectionInfo): Promise<void> {
    await this.saveInfoFile(collection, await this.getOrCreateDirPath(collection));
  }

  /**
   * Saves the info file of the given folder. Its children are not touched.
   * @param folder The folder to save.
   */
  public async saveFolder(folder: FolderInfo): Promise<void> {
    await this.saveInfoFile(folder, await this.getOrCreateDirPath(folder));
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
  private async saveInfoFile(object: InfoObject, dirPath: string) {
    logger.info('Saving object', object.id);
    await fs.mkdir(dirPath, { recursive: true });

    // the secrets are removed from a copy, the given object may be frozen
    const copy = structuredClone(object);
    await this.saveSecrets(copy, dirPath);

    // write the info file
    await this.writeJson(path.join(dirPath, getInfoFileName(copy.type)), toInfoFile(copy));
  }

  /**
   * Removes secrets from the given object and saves them to a separate file.
   * @param object the object to extract secrets from
   * @param dirPath the directory path where the secrets should be saved
   */
  private async saveSecrets(object: InfoObject, dirPath: string) {
    const filePath = path.join(dirPath, SECRETS_FILE_NAME);
    const secrets = extractSecrets(object);
    if (Object.keys(secrets).length > 0) {
      logger.debug(`Saving secrets for ${object.type} with ID [${object.id}]`);
      await secretService.writeJson(filePath, secrets);
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

    // the draft files replace the saved ones, then the saved files the draft no longer has go
    const [savedFiles, draftFiles] = await Promise.all([
      fs.readdir(dirPath),
      fs.readdir(draftDirPath),
    ]);
    await Promise.all(
      draftFiles.map((file) =>
        fileSystemService.isReplacementFile(file)
          ? fs.rm(path.join(draftDirPath, file), { force: true })
          : fs.rename(path.join(draftDirPath, file), path.join(dirPath, file))
      )
    );
    await Promise.all(
      savedFiles
        .filter((file) => file !== DRAFT_DIR_NAME && !draftFiles.includes(file))
        .map((file) => fs.rm(path.join(dirPath, file), { recursive: true, force: true }))
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

    if (!(await exists(path.join(dirPath, getInfoFileName('request'))))) {
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
    if (!(await exists(path.join(dirPath, getInfoFileName('request'))))) return;
    return await this.loadRequest(parentId, dirPath, false);
  }

  /**
   * Loads the text body of a request from the file system.
   * @param request the request to load the text body for
   * @param encoding the encoding of the text body. Default is binary.
   * @param range the offsets of the first and the last byte to load, e.g. to read it page by page
   * @returns the text body of the request if it exists
   */
  public async loadTextBodyOfRequest(
    request: TrufosRequest,
    encoding?: BufferEncoding,
    range?: { start?: number; end?: number }
  ): Promise<ReadStream | undefined> {
    if (request.body.type !== RequestBodyType.TEXT) return undefined;
    logger.info('Loading text body of request', request.id);
    const stream = await openFile(this.getTextBodyPath(request), encoding, range);
    if (stream == null) logger.warn('Text body file does not exist for request', request.id);
    return stream;
  }

  /**
   * @param request the request
   * @returns the size of the text body of the request in bytes, 0 if it has none
   */
  public async getTextBodySize(request: TrufosRequest): Promise<number> {
    if (request.body.type !== RequestBodyType.TEXT) return 0;
    try {
      return (await fs.stat(this.getTextBodyPath(request))).size;
    } catch (error) {
      if (isErrnoException(error) && error.code === 'ENOENT') return 0;
      throw error;
    }
  }

  private getTextBodyPath(request: TrufosRequest) {
    return path.join(this.getRequestDirPath(request), TEXT_BODY_FILE_NAME);
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
    await createGitIgnore(dirPath, GIT_IGNORE_LINES); // create .gitignore file
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
   * Reads the basic information of the collection at the given directory. Unlike
   * {@link loadCollection}, this does not register the collection's ID, so listing other open
   * collections cannot change where the files of the open collection are written, even if another
   * collection has the same ID (e.g. an imported export of it).
   * @param dirPath the directory path where the collection is located
   */
  public async loadCollectionBase(dirPath: string): Promise<CollectionBase> {
    dirPath = this.normalizeDirPath(dirPath);
    const info = await this.readInfoFile(dirPath, 'collection');
    return { id: info.id, title: info.title, dirPath };
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

  private walkChildren(parentId: string, parentDirPath: string): Promise<SnapshotChild[]> {
    return this.readChildren(parentDirPath, (childDirPath) =>
      this.walkChild(parentId, childDirPath)
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
    draft ??= await exists(path.join(this.getDraftDirPath(dirPath), getInfoFileName(type)));
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
    const infoFilePath = path.join(dirPath, getInfoFileName(type));
    const stats = await fs.stat(infoFilePath);
    return stats.mtimeMs;
  }

  private loadChildren(
    parentId: string,
    parentDirPath: string
  ): Promise<(Folder | TrufosRequest)[]> {
    return this.readChildren(parentDirPath, (childDirPath) =>
      this.load<Folder | TrufosRequest>(parentId, childDirPath)
    );
  }

  /**
   * Reads the children in a directory in the order of its order file.
   * @param parentDirPath the directory of the parent
   * @param readChild reads a child directory. Returns undefined for one that is no folder or request.
   */
  private async readChildren<T extends { id: string }>(
    parentDirPath: string,
    readChild: (childDirPath: string) => Promise<T | undefined>
  ): Promise<T[]> {
    const nodes = (await fs.readdir(parentDirPath, { withFileTypes: true })).filter(
      (node) => node.isDirectory() && node.name !== DRAFT_DIR_NAME
    );

    // Promise.all() resolves by index, so the children keep their directory order regardless of
    // which of them finishes reading first
    const [children, order] = await Promise.all([
      Promise.all(nodes.map((node) => readChild(path.join(parentDirPath, node.name)))),
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
    if (type === 'folder' || (await exists(path.join(dirPath, getInfoFileName('folder'))))) {
      return (await this.loadFolder(parentId, dirPath)) as T;
    } else if (
      type === 'request' ||
      (await exists(path.join(dirPath, getInfoFileName('request')))) ||
      (await exists(path.join(this.getDraftDirPath(dirPath), getInfoFileName('request'))))
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
    const filePath = path.join(dirPath, getInfoFileName(type));
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

  /**
   * Loads the secrets of an info file. They are only validated together with the info file they are
   * merged into, after migrating it, as they can be in the format of any older version.
   */
  private async loadSecrets(dirPath: string): Promise<Record<string, unknown>> {
    const filePath = path.join(dirPath, SECRETS_FILE_NAME);
    if (await exists(filePath)) {
      logger.debug('Loading secrets from', filePath);
      return await secretService.readJson(filePath, z.record(z.string(), z.unknown()));
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
  private async getOrCreateDirPath(object: InfoObject, respectDraft = false) {
    let dirPath = this.idToPathMap.get(object.id);
    if (dirPath == null) {
      dirPath = object.type === 'collection' ? object.dirPath : await this.createDirPath(object);
      this.idToPathMap.set(object.id, dirPath);
    }

    // check if we need to return the draft dir path
    if (respectDraft && object.type === 'request' && object.draft) {
      dirPath = this.getDraftDirPath(dirPath);
    }
    return dirPath;
  }

  /** Derives a new, unused directory path for a new folder or request from its parent. */
  private async createDirPath(node: FolderInfo | TrufosRequest) {
    const parentDirPath = this.getDirPath(node.parentId);
    const dirName = await uniqueNameAsync(sanitizeTitle(node.title), (name) =>
      this.isDirPathTaken(path.join(parentDirPath, name))
    );
    return path.join(parentDirPath, dirName);
  }

  /**
   * Returns the saved requests whose text body or script one of the given files is, see
   * {@link isContentFile}.
   * @param filePaths absolute paths of files
   * @returns the IDs of the requests. Files of drafts or of unknown requests are left out.
   */
  public requestsOfContentFiles(filePaths: readonly string[]): Set<string> {
    const idOfDirPath = new Map([...this.idToPathMap].map(([id, dirPath]) => [dirPath, id]));
    const ids = new Set<string>();
    for (const filePath of filePaths) {
      const id = isContentFile(filePath) ? idOfDirPath.get(path.dirname(filePath)) : undefined;
      if (id != null) ids.add(id);
    }
    return ids;
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
    for (const fileName of CONTENT_FILE_NAMES) {
      const filePath = path.join(sourceDirPath, fileName);
      if (await exists(filePath)) await fs.copyFile(filePath, path.join(targetDirPath, fileName));
    }
  }

  private async getScriptFilePath(request: TrufosRequest, type: ScriptType) {
    return path.join(await this.getOrCreateDirPath(request, true), getScriptFileName(type));
  }

  /**
   * Returns the directory the files of a request are read from: its draft directory if it has a
   * draft. Unlike {@link getOrCreateDirPath}, reading never reserves a directory.
   * @throws Error if the request has no directory, i.e. it was never saved
   */
  private getRequestDirPath(request: TrufosRequest) {
    const dirPath = this.getDirPath(request.id);
    return request.draft ? this.getDraftDirPath(dirPath) : dirPath;
  }

  /**
   * Whether a directory is used by a known object or exists on disk, e.g. left over from a crash.
   * Writing into or renaming onto such a directory would mix up or fail, so a free name is used.
   */
  private async isDirPathTaken(targetDirPath: string) {
    return (
      this.idToPathMap.values().some((path) => path === targetDirPath) ||
      (await exists(targetDirPath))
    );
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

  /** Writes a JSON file by replacing it, see {@link FileSystemService.replaceFile}. */
  private async writeJson(filePath: string, value: unknown) {
    await fileSystemService.replaceFile(filePath, JSON.stringify(value, null, 2));
  }
}

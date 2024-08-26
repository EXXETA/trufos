import path from 'node:path';
import fs from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {CollectionInfoFile, FolderInfoFile, RequestInfoFile, toInfoFile} from "./info-files";
import { Collection } from 'shim/collection';
import { Folder } from 'shim/folder';
import { RufusRequest } from 'shim/request';
import { exists, USER_DATA_DIR } from 'main/util/fs-util';
import { RufusObject } from 'shim/object';
import { generateDefaultCollection } from './default-collection';

/**
 * This service is responsible for persisting and loading collections, folders, and requests
 * to and from the file system.
 */
export class PersistenceService {
  private static readonly DEFAULT_COLLECTION_DIR = path.join(
    USER_DATA_DIR,
    "default-collection"
  );

  public static readonly instance = new PersistenceService();

  private idToPathMap: Map<string, string> = new Map();

  /**
   * Loads the default collection into memory.
   * @returns the default collection
   */
  public async loadDefaultCollection() {
    const dirPath = PersistenceService.DEFAULT_COLLECTION_DIR;
    if (await exists(dirPath)) {
      return await this.loadCollection(dirPath);
    }

    console.info("Creating default collection at", dirPath);
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

    oldParent.children = oldParent.children.filter(
      (c) => c.id !== child.id
    );
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

    if (object.type === "collection" || object.type === "folder") {
      for (const child of object.children) {
        this.updatePathMapRecursively(child, newDirPath);
      }
    }
  }

  /**
   * Creates or updates a rufus object on the file system.
   * @param object rufus object to be saved
   */
  public async save(object: RufusObject) {
    const dirPath = this.getDirPath(object);
    const infoFileContents = toInfoFile(object);
    const infoFilePath = path.join(dirPath, `${object.type}.json`);

    if (!(await exists(dirPath))) {
      await fs.mkdir(dirPath);
    }

    await fs.writeFile(infoFilePath, JSON.stringify(infoFileContents, null, 2));
    this.idToPathMap.set(object.id, dirPath);

    if (object.type === 'folder' || object.type === 'collection') {
      for (const child of object.children) {
        await this.save(child);
      }
    }
  }

  /**
   * Loads a collection and all of its children from the file system.
   * @param dirPath the directory path where the collection is located
   * @returns the loaded collection
   */
  public async loadCollection(dirPath: string): Promise<Collection> {
    const infoFilePath = path.join(dirPath, "collection.json");
    const infoFileContents = JSON.parse(
      await fs.readFile(infoFilePath, "utf8")
    ) as CollectionInfoFile;
    delete infoFileContents.version;
    const id = randomUUID();
    this.idToPathMap.set(id, dirPath);
    const children = await this.loadChildren(id, dirPath);
    return Object.assign(infoFileContents, {
      id,
      type: "collection" as const,
      dirPath,
      children,
    });
  }

  private async loadRequest(parentId: string, dirPath: string): Promise<RufusRequest> {
    const infoFilePath = path.join(dirPath, "request.json");
    const infoFileContents = JSON.parse(
      await fs.readFile(infoFilePath, "utf8")
    ) as RequestInfoFile;
    delete infoFileContents.version;
    const id = randomUUID();
    this.idToPathMap.set(id, dirPath);
    return Object.assign(infoFileContents, {
      id,
      parentId,
      type: "request" as const
    });
  }

  private async loadFolder(parentId: string, dirPath: string): Promise<Folder> {
    const infoFilePath = path.join(dirPath, "folder.json");
    const infoFileContents = JSON.parse(
      await fs.readFile(infoFilePath, "utf8")
    ) as FolderInfoFile;
    delete infoFileContents.version;
    const id = randomUUID();
    this.idToPathMap.set(id, dirPath);
    const children = await this.loadChildren(id, dirPath);
    return Object.assign(infoFileContents, {
      id,
      parentId,
      type: "folder" as const,
      children,
    });
  }

  private async loadChildren(
    parentId: string,
    parentDirPath: string
  ): Promise<(Folder | RufusRequest)[]> {
    const children: (Folder | RufusRequest)[] = [];

    for (const node of await fs.readdir(parentDirPath, {
      withFileTypes: true,
    })) {
      if (!node.isDirectory()) {
        continue;
      }

      const childDirPath = path.join(parentDirPath, node.name);
      const requestInfoFilePath = path.join(childDirPath, "request.json");
      const folderInfoFilePath = path.join(childDirPath, "folder.json");

      if (await exists(requestInfoFilePath)) {
        children.push(await this.loadRequest(parentId, childDirPath));
      } else if (await exists(folderInfoFilePath)) {
        children.push(await this.loadFolder(parentId, childDirPath));
      }
    }

    return children;
  }

  private updatePathMapRecursively(
    child: Folder | RufusRequest,
    newParentDirPath: string
  ) {
    const oldDirPath = this.idToPathMap.get(child.id);
    const dirName = path.basename(oldDirPath);
    const newDirPath = path.join(newParentDirPath, dirName);
    this.idToPathMap.set(child.id, newDirPath);
    if (child.type === "folder") {
      for (const grandChild of child.children) {
        this.updatePathMapRecursively(grandChild, newDirPath);
      }
    }
  }

  private getDirPath(object: RufusObject) {
    if (object.type === "collection") {
      return object.dirPath;
    }
    else if (this.idToPathMap.has(object.id)) {
      return this.idToPathMap.get(object.id);
    }
    else {
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
      .replace(/\s/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }
}
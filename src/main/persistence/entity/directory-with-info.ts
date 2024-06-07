import path from 'path';
import fs from 'fs/promises';

export type DirectoryWithInfoObject = {
  title: string;
  version: 'v1';
}

export enum DirectoryWithInfoType {
  COLLECTION = 'collection',
  FOLDER = 'folder',
  REQUEST = 'request'
}

export abstract class DirectoryWithInfo {

  public title: string;

  protected _dirName: string;

  protected _parent: string | DirectoryWithInfo;

  protected _children: Map<string, DirectoryWithInfo>;

  protected constructor(obj: DirectoryWithInfoObject, dirName: string, parent: string | DirectoryWithInfo) {
    this.title = obj.title;
    this._dirName = dirName;
    this._parent = parent;
    this._children = new Map();
  }

  public static nameToDirName(name: string) {
    return name
    .toLowerCase()
    .replace(/\s/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  }

  /** The parent folder or collection of this file or folder */
  get parent() {
    return this._parent;
  }

  /** The children of this folder or collection */
  get children() {
    return Array.from(this._children.values());
  }

  /** The absolute path to the parent directory (where this directory is located in) */
  get parentDirPath(): string {
    if (typeof this._parent === 'string') {
      return this._parent;
    } else {
      return this._parent.dirPath;
    }
  }

  /** The absolute path of this directory on disk */
  get dirPath(): string {
    return path.join(this.parentDirPath, this._dirName);
  }

  addChild(child: DirectoryWithInfo) {
    this._children.set(child._dirName, child);
  }

  removeChild(name: string) {
    return this._children.delete(name);
  }

  /**
   * Rename this directory
   * @param newName the new name of this directory
   */
  async rename(newName: string) {
    const oldDirPath = this.dirPath;
    this._dirName = newName;
    await fs.rename(oldDirPath, this.dirPath);
  }

  /**
   * Move this directory to a new parent directory
   * @param newParent the new parent directory
   */
  async move(newParent: string | DirectoryWithInfo) {
    if (newParent === this._parent) {
      return;
    }

    // Remove this directory from the old parent
    const oldDirPath = this.dirPath;
    if (this.parent instanceof DirectoryWithInfo) {
      this.parent.removeChild(this._dirName);
    }

    // Add this directory to the new parent
    this._parent = newParent;
    if (newParent instanceof DirectoryWithInfo) {
      newParent.addChild(this);
    }
    await fs.rename(oldDirPath, this.dirPath);
  }

  toObject(): DirectoryWithInfoObject {
    return { title: this.title, version: 'v1' };
  }
}

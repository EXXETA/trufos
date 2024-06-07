import {
  DirectoryWithInfo,
  DirectoryWithInfoObject,
  DirectoryWithInfoType
} from "./directory-with-info";
import {Request} from "./request";

export type FolderObject = DirectoryWithInfoObject & {
  type: DirectoryWithInfoType.FOLDER;
}

export class Folder extends DirectoryWithInfo {

  constructor(obj: FolderObject, dirName: string, parent: DirectoryWithInfo) {
    super(obj, dirName, parent);
  }

  toObject(): FolderObject {
    return Object.assign(super.toObject(), {type: DirectoryWithInfoType.FOLDER as DirectoryWithInfoType.FOLDER});
  }

  public get children(): (Folder | Request)[] {
    return super.children as (Folder | Request)[];
  }
}

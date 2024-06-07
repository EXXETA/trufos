import {
  DirectoryWithInfo,
  DirectoryWithInfoObject,
  DirectoryWithInfoType
} from 'main/persistence/entity/directory-with-info';
import { Folder } from 'main/persistence/entity/folder';
import { Request } from 'main/persistence/entity/request';
import { VariableObject } from 'main/environment/entity/variable';

export type CollectionObject = DirectoryWithInfoObject & {
  type: DirectoryWithInfoType.COLLECTION;
  variables: Record<string, VariableObject>;
}

export class Collection extends DirectoryWithInfo {

  public variables = new Map<string, VariableObject>();

  constructor(obj: CollectionObject, dirName: string, parent: string) {
    super(obj, dirName, parent);
    this.variables = new Map(Object.entries(obj.variables));
  }

  public toObject(): CollectionObject {
    return Object.assign(super.toObject(), {
      type: DirectoryWithInfoType.COLLECTION as DirectoryWithInfoType.COLLECTION,
      variables: Object.fromEntries(this.variables)
    });
  }

  public get children() {
    return super.children as (Folder | Request)[];
  }

}

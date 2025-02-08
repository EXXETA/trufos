import { RequestBody } from 'shim/objects/request';
import { VariableObject } from 'shim/objects/variables';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosHeader } from 'shim/objects/headers';
import { SemVer } from 'main/util/semver';

export const VERSION = new SemVer(1, 0, 0);

type InfoFileBase = {
  version: typeof VERSION.string;
  title: string;
};

type RequestInfoFile = InfoFileBase & {
  url: string;
  method: RequestMethod;
  headers: TrufosHeader[];
  body: RequestBody;
};

type FolderInfoFile = InfoFileBase;

type CollectionInfoFile = InfoFileBase & {
  variables: Record<VariableObject['key'], Omit<VariableObject, 'key'>>;
};

export type InfoFile = RequestInfoFile | FolderInfoFile | CollectionInfoFile;

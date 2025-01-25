import { RequestBody } from 'shim/objects/request';
import { VariableObject } from 'shim/variables';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosHeader } from 'shim/objects/headers';
import { InfoFileMapper } from './mapper';
import { InfoFile, VERSION } from './latest';
import { randomUUID } from 'node:crypto';

const OLD_VERSION = '1.0.0' as const;

type InfoFileBase = {
  version: typeof OLD_VERSION;
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

type InfoFileOld = RequestInfoFile | FolderInfoFile | CollectionInfoFile;

/**
 * Maps schema `v1.0.0` to `v1.0.1`.
 *
 * Changes:
 * - Adds an `id` property which will now be persisted.
 */
export class InfoFileMapperV1_0_0 extends InfoFileMapper<InfoFileOld, InfoFile> {
  public readonly fromVersion = OLD_VERSION;
  
  async migrate(old: InfoFileOld) {
    return Object.assign(old, { id: randomUUID(), version: VERSION });
  }
}

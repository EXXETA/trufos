import { RequestBody } from 'shim/objects/request';
import { VariableObject } from 'shim/variables';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosHeader } from 'shim/objects/headers';
import { SemVer } from 'main/util/semver';
import { InfoFile as OldInfoFile, VERSION as OLD_VERSION } from './v1-0-0';
import { AbstractInfoFileMigrator } from './migrator';
import { randomUUID } from 'node:crypto';

export const VERSION = new SemVer(1, 0, 1);

type InfoFileBase = {
  id: string;
  version: typeof VERSION.string;
  title: string;
};

export type RequestInfoFile = InfoFileBase & {
  url: string;
  method: RequestMethod;
  headers: TrufosHeader[];
  body: RequestBody;
};

export type FolderInfoFile = InfoFileBase;

export type CollectionInfoFile = InfoFileBase & {
  variables: Record<VariableObject['key'], Omit<VariableObject, 'key'>>;
};

export type InfoFile = RequestInfoFile | FolderInfoFile | CollectionInfoFile;

/**
 * Migrates schema `v1.0.0` to `v1.0.1`.
 *
 * Changes:
 * - Adds an `id` property which will now be persisted.
 */
export class InfoFileMigrator extends AbstractInfoFileMigrator<OldInfoFile, InfoFile> {
  public readonly fromVersion = OLD_VERSION.toString();

  async migrate(old: OldInfoFile) {
    return Object.assign(old, { id: randomUUID(), version: VERSION.toString() });
  }
}

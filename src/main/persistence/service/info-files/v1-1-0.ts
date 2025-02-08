import { RequestBody } from 'shim/objects/request';
import { VariableMap } from 'shim/objects/variables';
import { EnvironmentMap } from 'shim/objects/environment';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosHeader } from 'shim/objects/headers';
import { SemVer } from 'main/util/semver';
import { InfoFile as OldInfoFile, VERSION as OLD_VERSION } from './v1-0-1';
import { AbstractInfoFileMigrator } from './migrator';
import { TrufosObjectType } from 'shim/objects';

export const VERSION = new SemVer(1, 1, 0);

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
  variables: VariableMap;
  environments: EnvironmentMap;
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

  async migrate(old: OldInfoFile, type: TrufosObjectType): Promise<InfoFile> {
    if (type === 'collection') {
      return Object.assign(old, { version: VERSION.toString(), environments: {} });
    } else {
      return Object.assign(old, { version: VERSION.toString() });
    }
  }
}

import { RequestBody } from 'shim/objects/request';
import { VariableMap } from 'shim/objects/variables';
import { EnvironmentMap } from 'shim/objects/environment';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosHeader } from 'shim/objects/headers';
import { SemVer } from 'main/util/semver';
import { InfoFile as OldInfoFile, VERSION as OLD_VERSION } from './v1-1-0';
import { AbstractInfoFileMigrator } from './migrator';
import { TrufosObjectType } from 'shim/objects';
import { PersistenceService } from '../persistence-service';
import { dirname } from 'node:path';

export const VERSION = new SemVer(1, 2, 0);

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
  environments: EnvironmentMap;
  variables: VariableMap;
};

export type InfoFile = RequestInfoFile | FolderInfoFile | CollectionInfoFile;

/**
 * Migrates schema `v1.1.0` to `v1.2.0`.
 *
 * Changes:
 * - Adds the `variables` property to request info files.
 */
export class InfoFileMigrator extends AbstractInfoFileMigrator<OldInfoFile, InfoFile> {
  public readonly fromVersion = OLD_VERSION.toString();

  async migrate(old: OldInfoFile, type: TrufosObjectType, filePath: string): Promise<InfoFile> {
    if (type === 'collection') await PersistenceService.instance.createGitIgnore(dirname(filePath));
    return Object.assign(old, { version: VERSION.toString() });
  }
}

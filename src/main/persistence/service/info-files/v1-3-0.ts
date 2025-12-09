import { RequestBody } from 'shim/objects/request';
import { VariableMap } from 'shim/objects/variables';
import { EnvironmentMap } from 'shim/objects/environment';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosHeader } from 'shim/objects/headers';
import { SemVer } from 'main/util/semver';
import { AbstractInfoFileMigrator } from './migrator';
import { TrufosObjectType } from 'shim/objects';
import { AuthorizationInformation, InheritAuthorizationInformation } from 'shim/objects';

import { InfoFile as OldInfoFile, VERSION as OLD_VERSION } from './v1-2-0';

export const VERSION = new SemVer(1, 3, 0);

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
  auth?: AuthorizationInformation;
};

export type FolderInfoFile = InfoFileBase;

export type CollectionInfoFile = InfoFileBase & {
  environments: EnvironmentMap;
  variables: VariableMap;
  auth?: Exclude<AuthorizationInformation, InheritAuthorizationInformation>;
};

export type InfoFile = RequestInfoFile | FolderInfoFile | CollectionInfoFile;

/**
 * Migrates schema `v1.2.0` to `v1.3.0`.
 *
 * Changes:
 * - Supports the `auth` property in request and collection info files. Since this is optional, no actual migration is needed.
 */
export class InfoFileMigrator extends AbstractInfoFileMigrator<OldInfoFile, InfoFile> {
  public readonly fromVersion = OLD_VERSION.toString();

  async migrate(old: OldInfoFile, type: TrufosObjectType, filePath: string): Promise<InfoFile> {
    return Object.assign(old, { version: VERSION.toString() });
  }
}

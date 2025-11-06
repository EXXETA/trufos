import { RequestBody } from 'shim/objects/request';
import { VariableMap } from 'shim/objects/variables';
import { EnvironmentMap } from 'shim/objects/environment';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosHeader } from 'shim/objects/headers';
import { SemVer } from 'main/util/semver';
import { AbstractInfoFileMigrator } from './migrator';
import { TrufosObjectType } from 'shim/objects';
import { AuthorizationInformation, InheritAuthorizationInformation } from 'shim/objects/auth';
import {
  InfoFile as OldInfoFile,
  RequestInfoFile as OldRequestInfoFile,
  VERSION as OLD_VERSION,
} from './v2-0-0';
import { parseUrl, TrufosURL } from 'shim/objects/url';

export const VERSION = new SemVer(2, 1, 0);

type InfoFileBase = {
  id: string;
  version: typeof VERSION.string;
  title: string;
  index?: number;
};

export type RequestInfoFile = InfoFileBase & {
  url: TrufosURL;
  method: RequestMethod;
  headers: TrufosHeader[];
  body: RequestBody;
  auth?: AuthorizationInformation;
};

export type FolderInfoFile = InfoFileBase;

export type CollectionInfoFile = Omit<InfoFileBase, 'index'> & {
  environments: EnvironmentMap;
  variables: VariableMap;
  auth?: Exclude<AuthorizationInformation, InheritAuthorizationInformation>;
};

export type InfoFile = RequestInfoFile | FolderInfoFile | CollectionInfoFile;

/**
 * Migrates schema `v2.0.0` to `v2.1.0`.
 *
 * Changes:
 * - Persist request URL as object
 */
export class InfoFileMigrator extends AbstractInfoFileMigrator<OldInfoFile, InfoFile> {
  public readonly fromVersion = OLD_VERSION.toString();

  async migrate(old: OldInfoFile, type: TrufosObjectType, filePath: string): Promise<InfoFile> {
    if (type === 'request') {
      const request = old as OldRequestInfoFile;
      return Object.assign(request, {
        version: VERSION.toString(),
        url: parseUrl(request.url),
      });
    } else {
      return Object.assign(old, { version: VERSION.toString() });
    }
  }
}

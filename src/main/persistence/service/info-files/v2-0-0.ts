import { RequestBody } from 'shim/objects/request';
import { VariableMap } from 'shim/objects/variables';
import { EnvironmentMap } from 'shim/objects/environment';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosHeader } from 'shim/objects/headers';
import { SemVer } from 'main/util/semver';
import { AbstractInfoFileMigrator } from './migrator';
import { TrufosObjectType } from 'shim/objects';
import { AuthorizationInformation, InheritAuthorizationInformation } from 'shim/objects/auth';

import { InfoFile as OldInfoFile, VERSION as OLD_VERSION } from './v1-4-0';
import {
  DRAFT_DIR_NAME,
  PersistenceService,
  SECRETS_FILE_NAME,
} from 'main/persistence/service/persistence-service';
import path from 'node:path';
import { exists } from 'main/util/fs-util';
import fs from 'node:fs/promises';

export const VERSION = new SemVer(2, 0, 0);

type InfoFileBase = {
  id: string;
  version: typeof VERSION.string;
  title: string;
  index?: number;
};

export type RequestInfoFile = InfoFileBase & {
  url: string;
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

const OLD_DRAFT_PREFIX = '~';
const OLD_SECRETS_FILE_NAME = '~secrets.json.bin';

/**
 * Migrates schema `v1.4.0` to `v2.0.0`.
 *
 * Changes:
 * - Rename secrets file from `~secrets.json.bin` to `.secrets.bin`
 * - Keep all draft files in an own `.draft` directory
 * - Only ignore `.draft` directory in gitignore
 */
export class InfoFileMigrator extends AbstractInfoFileMigrator<OldInfoFile, InfoFile> {
  public readonly fromVersion = OLD_VERSION.toString();

  public readonly mustSaveFile = true;

  async migrate(old: OldInfoFile, type: TrufosObjectType, filePath: string): Promise<InfoFile> {
    const dirPath = path.dirname(filePath);
    if (type === 'collection') {
      await PersistenceService.instance.createGitIgnore(dirPath);
    } else if (type === 'request') {
      await this.renameRequestFiles(dirPath);
    }
    await this.applyNewVersion(filePath);
    return this.applyChanges(old);
  }

  private applyChanges(old: OldInfoFile): InfoFile {
    return Object.assign(old, { version: VERSION.toString() });
  }

  private async applyNewVersion(filePath: string) {
    const content = this.applyChanges(
      JSON.parse(await fs.readFile(filePath, 'utf8')) as OldInfoFile
    );
    await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf8');
  }

  private async renameRequestFiles(dirPath: string) {
    await this.renameSecretsFile(dirPath);
    await this.moveDraftsToDraftDir(dirPath);
  }

  private async renameSecretsFile(dirPath: string) {
    for (const file of await fs.readdir(dirPath, { withFileTypes: true })) {
      if (!file.isFile()) continue;
      if (file.name.endsWith(OLD_SECRETS_FILE_NAME)) {
        await fs.rename(
          path.join(dirPath, file.name),
          path.join(dirPath, file.name.replace(OLD_SECRETS_FILE_NAME, SECRETS_FILE_NAME))
        );
      }
    }
  }

  private async moveDraftsToDraftDir(dirPath: string) {
    const draftDirPath = path.join(dirPath, DRAFT_DIR_NAME);
    for (const file of await fs.readdir(dirPath, { withFileTypes: true })) {
      if (!file.isFile()) continue;

      // move to draft
      if (file.name.startsWith(OLD_DRAFT_PREFIX)) {
        if (file.name.endsWith('request.json')) {
          await this.applyNewVersion(path.join(dirPath, file.name));
        }
        await fs.mkdir(draftDirPath, { recursive: true });
        await fs.rename(
          path.join(dirPath, file.name),
          path.join(draftDirPath, file.name.substring(OLD_DRAFT_PREFIX.length))
        );
      }
    }
  }
}

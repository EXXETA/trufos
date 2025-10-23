import { RequestBody } from 'shim/objects/request';
import { VariableMap } from 'shim/objects/variables';
import { EnvironmentMap } from 'shim/objects/environment';
import { RequestMethod } from 'shim/objects/request-method';
import { TrufosHeader } from 'shim/objects/headers';
import { SemVer } from 'main/util/semver';
import { InfoFile as OldInfoFile, VERSION as OLD_VERSION } from './v1-1-0';
import { AbstractInfoFileMigrator } from './migrator';
import { TrufosObjectType } from 'shim/objects';
import { dirname, join } from 'node:path';
import fs from 'node:fs/promises';

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
 * - Creates a `.gitignore` file in the collection directory.
 */
export class InfoFileMigrator extends AbstractInfoFileMigrator<OldInfoFile, InfoFile> {
  public readonly fromVersion = OLD_VERSION.toString();

  async migrate(old: OldInfoFile, type: TrufosObjectType, filePath: string): Promise<InfoFile> {
    if (type === 'collection') await createGitIgnore(dirname(filePath));
    return Object.assign(old, { version: VERSION.toString() });
  }
}

/**
 * Creates a collection .gitignore file in the specified directory path.
 * Exported for consistency with later migrators and reuse from services.
 * @param dirPath the directory path where the .gitignore file should be created
 */
export async function createGitIgnore(dirPath: string) {
  const gitIgnorePath = join(dirPath, '.gitignore');
  logger.info(`Creating .gitignore file at`, gitIgnorePath);
  await fs.writeFile(gitIgnorePath, '~*');
}

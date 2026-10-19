import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FolderInfoFile, GIT_IGNORE_LINES, InfoFileMigrator, VERSION } from './v2-5-0';
import { GIT_IGNORE_FILE_NAME } from '../git-ignore';
import {
  CollectionInfoFile as OldCollectionInfoFile,
  FolderInfoFile as OldFolderInfoFile,
  VERSION as OLD_VERSION,
} from './v2-4-0';
import { AuthorizationType } from 'shim/objects/auth';

describe('InfoFileMigrator v2.5.0', () => {
  const migrator = new InfoFileMigrator();

  it('migrates a folder by bumping the version', async () => {
    // Arrange
    const old: OldFolderInfoFile = {
      id: randomUUID(),
      title: 'Folder',
      version: OLD_VERSION.string,
    };

    // Act
    const migrated = await migrator.migrate(structuredClone(old), 'folder', 'folder.json');

    // Assert
    expect(migrated).toEqual({ ...old, version: VERSION.string });
    await expect(migrated).toBeOfSchemaAsync(FolderInfoFile);
  });

  it('accepts a folder with an authorization, but not one that inherits', async () => {
    // Arrange
    const folder = { id: randomUUID(), title: 'Folder', version: VERSION.string };

    // Act & Assert
    await expect({
      ...folder,
      auth: { type: AuthorizationType.BEARER, token: 't' },
    }).toBeOfSchemaAsync(FolderInfoFile);
    await expect({
      ...folder,
      auth: { type: AuthorizationType.INHERIT },
    }).not.toBeOfSchemaAsync(FolderInfoFile);
  });
});

describe('InfoFileMigrator v2.5.0 .gitignore', () => {
  const migrator = new InfoFileMigrator();
  let dirPath: string;

  beforeEach(async () => {
    dirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'trufos-v2-5-0-'));
  });

  afterEach(async () => {
    await fs.rm(dirPath, { recursive: true, force: true });
  });

  it('adds the pattern of temporary files to the .gitignore of a collection', async () => {
    // Arrange
    await fs.writeFile(path.join(dirPath, GIT_IGNORE_FILE_NAME), '.draft\n.secrets.bin');
    const collection: OldCollectionInfoFile = {
      id: randomUUID(),
      title: 'Collection',
      version: OLD_VERSION.string,
      variables: {},
      environments: {},
    };

    // Act
    await migrator.migrate(collection, 'collection', path.join(dirPath, 'collection.json'));

    // Assert
    expect(await fs.readFile(path.join(dirPath, GIT_IGNORE_FILE_NAME), 'utf8')).toBe(
      GIT_IGNORE_LINES.join('\n')
    );
  });

  it('does not touch the .gitignore for folders', async () => {
    // Act
    await migrator.migrate(
      { id: randomUUID(), title: 'Folder', version: OLD_VERSION.string },
      'folder',
      path.join(dirPath, 'folder.json')
    );

    // Assert
    await expect(fs.access(path.join(dirPath, GIT_IGNORE_FILE_NAME))).rejects.toThrow();
  });
});

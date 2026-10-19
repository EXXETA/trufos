import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { FolderInfoFile, InfoFileMigrator, VERSION } from './v2-5-0';
import { FolderInfoFile as OldFolderInfoFile, VERSION as OLD_VERSION } from './v2-4-0';
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

import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  CollectionInfoFile,
  FolderInfoFile,
  InfoFileMigrator,
  RequestInfoFile,
  VERSION,
} from './v2-6-0';
import { FolderInfoFile as OldFolderInfoFile, VERSION as OLD_VERSION } from './v2-5-0';
import { AuthorizationType } from 'shim/objects/auth';
import { RequestBodyType } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { parseUrl } from 'shim/objects/url';

describe('InfoFileMigrator v2.6.0', () => {
  const migrator = new InfoFileMigrator();

  it('migrates by bumping the version', async () => {
    // Arrange
    const old: OldFolderInfoFile = {
      id: randomUUID(),
      title: 'Folder',
      version: OLD_VERSION.string,
      auth: { type: AuthorizationType.BASIC, username: 'user', password: 'pass' },
    };

    // Act
    const migrated = await migrator.migrate(structuredClone(old), 'folder', 'folder.json');

    // Assert
    expect(migrated).toEqual({ ...old, version: VERSION.string });
    await expect(migrated).toBeOfSchemaAsync(FolderInfoFile);
  });

  it('accepts digest authorizations on requests, folders and the collection', async () => {
    // Arrange
    const base = { id: randomUUID(), title: 'Object', version: VERSION.string };
    const auth = { type: AuthorizationType.DIGEST, username: 'user', password: 'pass' };

    // Act & Assert
    await expect({
      ...base,
      url: parseUrl('https://example.com'),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.NONE },
      auth,
    }).toBeOfSchemaAsync(RequestInfoFile);
    await expect({ ...base, auth }).toBeOfSchemaAsync(FolderInfoFile);
    await expect({ ...base, variables: {}, environments: {}, auth }).toBeOfSchemaAsync(
      CollectionInfoFile
    );
  });
});

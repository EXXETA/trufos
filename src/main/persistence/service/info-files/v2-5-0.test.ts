import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  CollectionInfoFile,
  FolderInfoFile,
  GIT_IGNORE_LINES,
  InfoFileMigrator,
  RequestInfoFile,
  VERSION,
} from './v2-5-0';
import { GIT_IGNORE_FILE_NAME } from '../git-ignore';
import {
  CollectionInfoFile as OldCollectionInfoFile,
  FolderInfoFile as OldFolderInfoFile,
  RequestInfoFile as OldRequestInfoFile,
  VERSION as OLD_VERSION,
} from './v2-4-0';
import { AuthorizationType } from 'shim/objects/auth';
import { RequestBodyType } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { parseUrl } from 'shim/objects/url';

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

  it('accepts headers on folders and the collection, and disabled inherited headers on requests', async () => {
    // Arrange
    const base = { id: randomUUID(), title: 'Object', version: VERSION.string };
    const headers = [{ key: 'X-Tenant', value: 'acme', isActive: true }];

    // Act & Assert
    await expect({ ...base, headers }).toBeOfSchemaAsync(FolderInfoFile);
    await expect({ ...base, variables: {}, environments: {}, headers }).toBeOfSchemaAsync(
      CollectionInfoFile
    );
    await expect({
      ...base,
      url: parseUrl('https://example.com'),
      method: RequestMethod.GET,
      headers: [],
      disabledHeaders: ['x-tenant'],
      body: { type: RequestBodyType.NONE },
    }).toBeOfSchemaAsync(RequestInfoFile);
  });

  it('accepts a request without a body, which older versions do not', async () => {
    // Arrange
    const request = {
      id: randomUUID(),
      title: 'Request',
      url: parseUrl('https://example.com'),
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.NONE },
    };

    // Act & Assert
    await expect({ ...request, version: VERSION.string }).toBeOfSchemaAsync(RequestInfoFile);
    await expect({ ...request, version: OLD_VERSION.string }).not.toBeOfSchemaAsync(
      OldRequestInfoFile
    );
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

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { InfoFileMigrator as MigratorV2_1_0, VERSION, RequestInfoFile } from './v2-1-0';
import {
  InfoFile as OldInfoFile,
  RequestInfoFile as OldRequestInfoFile,
  FolderInfoFile as OldFolderInfoFile,
  CollectionInfoFile as OldCollectionInfoFile,
  VERSION as OLD_VERSION,
} from './v2-0-0';
import { RequestMethod } from 'shim/objects/request-method';
import { RequestBodyType } from 'shim/objects/request';
import { randomUUID } from 'node:crypto';

async function readJson<T>(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function writeJson<T>(filePath: string, data: T) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

describe('InfoFileMigrator v2.1.0', () => {
  const dirPath = path.join(os.tmpdir(), 'info-files-test');
  const migrator = new MigratorV2_1_0();

  beforeEach(async () => {
    await fs.mkdir(dirPath, { recursive: true });
  });

  it('migrates request: converts url string to object and bumps version', async () => {
    // Arrange
    const oldRequest: OldRequestInfoFile = {
      id: randomUUID(),
      title: 'Request With Query',
      version: OLD_VERSION.string,
      url: 'https://example.com/path?foo=bar&foo=baz&x=1',
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    const filePath = path.join(dirPath, 'request.json');
    await writeJson(filePath, oldRequest);

    // Act
    const migrated = await migrator.migrate(structuredClone(oldRequest), 'request', filePath);
    const migratedRequest = migrated as RequestInfoFile;

    // Assert: version bumped
    expect(migratedRequest.version).toBe(VERSION.string);

    // URL transformed
    expect(migratedRequest.url).toBeTypeOf('object');
    expect(migratedRequest.url.base).toBe('https://example.com/path');
    expect(Array.isArray(migratedRequest.url.query)).toBe(true);
    expect(migratedRequest.url.query).toEqual([
      { key: 'foo', value: 'bar', isActive: true },
      { key: 'foo', value: 'baz', isActive: true },
      { key: 'x', value: '1', isActive: true },
    ]);

    // Original file content NOT yet updated on disk
    const originalOnDisk = await readJson<OldRequestInfoFile>(filePath);
    expect(originalOnDisk.version).toBe(OLD_VERSION.string);
    expect(originalOnDisk.url).toBeTypeOf('string');
  });

  it('migrates request without query: empty query array', async () => {
    const oldRequest: OldRequestInfoFile = {
      id: randomUUID(),
      title: 'No Query Request',
      version: OLD_VERSION.string,
      url: 'https://example.org',
      method: RequestMethod.POST,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    const filePath = path.join(dirPath, 'request-no-query.json');
    await writeJson(filePath, oldRequest);

    const migrated = await migrator.migrate(
      structuredClone(oldRequest) as OldInfoFile,
      'request',
      filePath
    );
    const migratedRequest = migrated as RequestInfoFile;

    expect(migratedRequest.version).toBe(VERSION.string);
    expect(migratedRequest.url.base).toBe('https://example.org');
    expect(migratedRequest.url.query).toEqual([]);
  });

  it('migrates collection: only bumps version', async () => {
    // Arrange
    const oldCollection: OldCollectionInfoFile = {
      id: randomUUID(),
      title: 'Collection',
      version: OLD_VERSION.string,
      environments: {},
      variables: {},
    };

    const filePath = path.join(dirPath, 'collection.json');
    await writeJson(filePath, oldCollection);

    // Act
    const migrated = await migrator.migrate(structuredClone(oldCollection), 'collection', filePath);

    // Assert
    expect(migrated.version).toBe(VERSION.string);
    const onDisk = await readJson<OldInfoFile>(filePath);
    expect(onDisk.version).toBe(OLD_VERSION.string); // unchanged until saved externally
  });

  it('migrates folder: only bumps version', async () => {
    // Arrange
    const oldFolder: OldFolderInfoFile = {
      id: randomUUID(),
      title: 'Folder',
      version: OLD_VERSION.string,
      index: 1,
    };

    const filePath = path.join(dirPath, 'folder.json');
    await writeJson(filePath, oldFolder);

    // Act
    const migrated = await migrator.migrate(structuredClone(oldFolder), 'folder', filePath);

    // Assert
    expect(migrated.version).toBe(VERSION.string);
    const onDisk = await readJson<OldInfoFile>(filePath);
    expect(onDisk.version).toBe(OLD_VERSION.string);
  });
});

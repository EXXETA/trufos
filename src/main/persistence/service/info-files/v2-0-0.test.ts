import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { InfoFileMigrator as MigratorV2_2_0, VERSION } from './v2-0-0';
import { InfoFile as OldInfoFile, VERSION as OLD_VERSION } from './v1-4-0';
import { DRAFT_DIR_NAME, SECRETS_FILE_NAME } from 'main/persistence/constants';
import { RequestMethod } from 'shim/objects/request-method';
import { RequestBodyType } from 'shim/objects/request';
import { randomUUID } from 'node:crypto';
import { exists } from 'main/util/fs-util';

async function readJson<T>(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function writeJson<T>(filePath: string, data: T) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

describe('InfoFileMigrator v2.0.0', () => {
  const dirPath = path.join(os.tmpdir(), 'info-files-test');
  const migrator = new MigratorV2_2_0();

  beforeEach(async () => {
    await fs.mkdir(dirPath, { recursive: true });
  });

  it('migrates request: moves draft files to .draft, upgrades versions, and renames secrets file', async () => {
    // Arrange
    const oldRequestInfo: OldInfoFile = {
      id: randomUUID(),
      title: 'Original Request',
      version: OLD_VERSION.string,
      url: 'https://example.com',
      method: RequestMethod.GET,
      headers: [],
      body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    };

    const oldDraftRequestInfo: OldInfoFile = {
      ...oldRequestInfo,
      title: 'Draft Title',
    };

    const requestFilePath = path.join(dirPath, 'request.json');

    // Write original files
    await writeJson(requestFilePath, oldRequestInfo);
    await fs.writeFile(path.join(dirPath, '~secrets.json.bin'), 'secret-data');
    await fs.writeFile(path.join(dirPath, 'request-body.txt'), 'content');

    // Write draft files
    await writeJson(path.join(dirPath, '~request.json'), oldDraftRequestInfo);
    await fs.writeFile(path.join(dirPath, '~~secrets.json.bin'), 'draft-secret-data');
    await fs.writeFile(path.join(dirPath, '~request-body.txt'), 'draft-content');

    // Act
    const migrated = await migrator.migrate(
      structuredClone(oldDraftRequestInfo),
      'request',
      requestFilePath
    );

    // Assert
    expect(migrated.version).toBe(VERSION.string);

    expect(await exists(path.join(dirPath, '~request.json'))).toBe(false);
    expect(await exists(path.join(dirPath, '~secrets.json.bin'))).toBe(false);
    expect(await exists(path.join(dirPath, '~~secrets.json.bin'))).toBe(false);
    expect(await exists(path.join(dirPath, '~request-body.txt'))).toBe(false);

    expect(await exists(path.join(dirPath, 'request.json'))).toBe(true);
    expect(await exists(path.join(dirPath, SECRETS_FILE_NAME))).toBe(true);
    expect(await exists(path.join(dirPath, 'request-body.txt'))).toBe(true);
    expect(await exists(path.join(dirPath, DRAFT_DIR_NAME, 'request-body.txt'))).toBe(true);
    expect(await exists(path.join(dirPath, DRAFT_DIR_NAME, SECRETS_FILE_NAME))).toBe(true);
    expect(await exists(path.join(dirPath, DRAFT_DIR_NAME, 'request.json'))).toBe(true);

    expect(await readJson<OldInfoFile>(path.join(dirPath, DRAFT_DIR_NAME, 'request.json'))).toEqual(
      {
        ...oldDraftRequestInfo,
        version: VERSION.string,
      }
    );
    expect(await readJson<OldInfoFile>(path.join(dirPath, 'request.json'))).toEqual({
      ...oldRequestInfo,
      version: VERSION.string,
    });
    expect(migrated).toEqual(
      await readJson<OldInfoFile>(path.join(dirPath, DRAFT_DIR_NAME, 'request.json'))
    );
  });

  it('migrates collection: creates .gitignore, renames secrets file, bumps version', async () => {
    // Arrange
    const collectionDir = path.join(dirPath, 'my-collection');
    await fs.mkdir(collectionDir, { recursive: true });

    const oldCollectionInfo: OldInfoFile = {
      id: randomUUID(),
      title: 'Test Collection',
      version: OLD_VERSION.string,
      environments: {},
      variables: {},
    };

    const infoFilePath = path.join(collectionDir, 'collection.json');
    await writeJson(infoFilePath, oldCollectionInfo);
    await fs.writeFile(path.join(collectionDir, '~secrets.json.bin'), 'secret-data');

    // Act
    const migrated = await migrator.migrate(
      structuredClone(oldCollectionInfo),
      'collection',
      infoFilePath
    );

    // Assert: version updated in returned object
    expect(migrated.version).toBe(VERSION.string);

    // Info file content updated
    const saved = await readJson<OldInfoFile>(infoFilePath);
    expect(saved.version).toBe(VERSION.string);

    // Secrets file renamed
    expect(await exists(path.join(collectionDir, '~secrets.json.bin'))).toBe(false);
    expect(await exists(path.join(collectionDir, SECRETS_FILE_NAME))).toBe(true);

    // .gitignore created with expected content
    const gitIgnorePath = path.join(collectionDir, '.gitignore');
    expect(await exists(gitIgnorePath)).toBe(true);
    const gitIgnoreContent = await fs.readFile(gitIgnorePath, 'utf8');
    expect(gitIgnoreContent).toContain('.draft');
  });

  it('migrates folder: only bumps version (no gitignore, no secrets rename)', async () => {
    // Arrange
    const folderDir = path.join(dirPath, 'some-folder');
    await fs.mkdir(folderDir, { recursive: true });
    const oldFolderInfo: OldInfoFile = {
      id: randomUUID(),
      title: 'Folder Title',
      version: OLD_VERSION.string,
      index: 3,
    };

    const infoFilePath = path.join(folderDir, 'folder.json');
    await writeJson(infoFilePath, oldFolderInfo);

    // Act
    const migrated = await migrator.migrate(structuredClone(oldFolderInfo), 'folder', infoFilePath);

    // Assert: version bumped
    expect(migrated.version).toBe(VERSION.string);
    const saved = await readJson<OldInfoFile>(infoFilePath);
    expect(saved.version).toBe(VERSION.string);

    // No .gitignore (only collections get one)
    expect(await exists(path.join(folderDir, '.gitignore'))).toBe(false);

    // No secrets file should appear (folder migration doesn't create or rename secrets)
    expect(await exists(path.join(folderDir, SECRETS_FILE_NAME))).toBe(false);

    // No draft directory unexpectedly created
    expect(await exists(path.join(folderDir, DRAFT_DIR_NAME))).toBe(false);
  });
});

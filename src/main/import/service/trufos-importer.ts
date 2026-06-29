import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { openPromise, type Entry, type ZipFile } from 'yauzl';
import { Collection } from 'shim/objects/collection';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { exists } from 'main/util/fs-util';

const COLLECTION_INFO_FILE_NAME = 'collection.json';
const STAGING_DIR_PREFIX = '.trufos-import-';
const UNIX_SYMLINK_FILE_TYPE = 0o120000;
const UNIX_FILE_TYPE_MASK = 0o170000;

export class TrufosImporter {
  constructor(
    private readonly persistenceService: PersistenceService = PersistenceService.instance
  ) {}

  public async importCollection(srcFilePath: string, targetDirPath: string): Promise<Collection> {
    const stagingDirPath = path.join(targetDirPath, `${STAGING_DIR_PREFIX}${randomUUID()}`);

    try {
      await fs.mkdir(stagingDirPath, { recursive: true });
      await this.extractZip(srcFilePath, stagingDirPath);

      const collectionRoot = await this.findCollectionRoot(stagingDirPath);
      const finalDirPath = path.join(targetDirPath, path.basename(collectionRoot));
      if (await exists(finalDirPath)) {
        throw new Error(`Collection directory already exists at "${finalDirPath}"`);
      }

      await fs.rename(collectionRoot, finalDirPath);
      return await this.persistenceService.loadCollection(finalDirPath);
    } catch (error) {
      await fs.rm(stagingDirPath, { recursive: true, force: true }).catch(logger.warn);
      throw error;
    } finally {
      await fs.rm(stagingDirPath, { recursive: true, force: true }).catch(logger.warn);
    }
  }

  private async extractZip(srcFilePath: string, stagingDirPath: string) {
    const zipFile = await openPromise(srcFilePath, {
      lazyEntries: true,
      strictFileNames: false,
      validateEntrySizes: true,
    });

    try {
      for await (const entry of zipFile.eachEntry()) {
        await this.extractEntry(zipFile, entry, stagingDirPath);
      }
    } finally {
      zipFile.close();
    }
  }

  private async extractEntry(zipFile: ZipFile, entry: Entry, stagingDirPath: string) {
    this.validateEntry(entry);

    const destinationPath = this.resolveDestinationPath(stagingDirPath, entry.fileName);
    if (entry.fileName.endsWith('/')) {
      await fs.mkdir(destinationPath, { recursive: true });
      return;
    }

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await pipeline(await zipFile.openReadStreamPromise(entry), createWriteStream(destinationPath));
  }

  private validateEntry(entry: Entry) {
    const unixFileType = (entry.externalFileAttributes >>> 16) & UNIX_FILE_TYPE_MASK;
    if (unixFileType === UNIX_SYMLINK_FILE_TYPE) {
      throw new Error(`Refusing to import symlink from ZIP entry "${entry.fileName}"`);
    }

    if (entry.isEncrypted() || !entry.canDecodeFileData()) {
      throw new Error(`Unsupported ZIP entry "${entry.fileName}"`);
    }
  }

  private resolveDestinationPath(stagingDirPath: string, fileName: string) {
    const normalized = path.posix.normalize(fileName);
    if (
      normalized === '.' ||
      normalized.startsWith('../') ||
      path.posix.isAbsolute(normalized) ||
      fileName.includes('\\') ||
      /^[a-zA-Z]:/.test(fileName)
    ) {
      throw new Error(`Unsafe ZIP entry path "${fileName}"`);
    }

    const destinationPath = path.resolve(stagingDirPath, ...normalized.split('/'));
    const stagingRoot = path.resolve(stagingDirPath);
    if (
      destinationPath !== stagingRoot &&
      !destinationPath.startsWith(`${stagingRoot}${path.sep}`)
    ) {
      throw new Error(`Unsafe ZIP entry path "${fileName}"`);
    }

    return destinationPath;
  }

  private async findCollectionRoot(stagingDirPath: string) {
    const topLevelEntries = await fs.readdir(stagingDirPath, {
      withFileTypes: true,
    });
    if (topLevelEntries.length !== 1 || !topLevelEntries[0].isDirectory()) {
      throw new Error('Trufos ZIP must contain exactly one collection directory');
    }

    const collectionRoot = path.join(stagingDirPath, topLevelEntries[0].name);
    if (!(await exists(path.join(collectionRoot, COLLECTION_INFO_FILE_NAME)))) {
      throw new Error(`Trufos ZIP collection directory must contain ${COLLECTION_INFO_FILE_NAME}`);
    }

    return collectionRoot;
  }
}

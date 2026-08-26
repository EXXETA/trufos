import { InternalError, InternalErrorType } from 'main/error/internal-error';
import { Collection } from 'shim/objects/collection';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { PostmanImporter } from './postman-importer';
import { OpenApiImporter } from './openapi-importer';
import { BrunoImporter } from './bruno-importer';
import type { ImportResult, ImportStrategy, ImportWarning } from 'shim/event-service';
import { sanitizeTitle, uniqueNameAsync } from 'shim/string';
import { exists, isEmpty } from 'main/util/fs-util';
import fs from 'node:fs/promises';
import path from 'path';

export interface CollectionImporter {
  /**
   * Reads a third-party collection from the given file or directory
   * @param srcFilePath the file or directory to read from
   */
  importCollection(srcFilePath: string): Promise<Collection>;
  getWarnings?(): ImportWarning[];
}

const persistenceService = PersistenceService.instance;

export class ImportService {
  public static readonly instance = new ImportService();

  static {
    ImportService.instance.registerImporter('Postman', new PostmanImporter());
    ImportService.instance.registerImporter('OpenAPI', new OpenApiImporter());
    ImportService.instance.registerImporter('Bruno', new BrunoImporter());
  }

  private readonly importers: Map<ImportStrategy, CollectionImporter> = new Map();

  public registerImporter(strategy: ImportStrategy, importer: CollectionImporter) {
    this.importers.set(strategy, importer);
  }

  /**
   * Imports a third-party collection from the given file or directory
   * @param srcFilePath the file or directory to read from
   * @param targetDirPath the directory to save the imported collection to. Will create a subdirectory based on the collection title.
   * @param strategy the import strategy to use (e.g. Postman)
   * @param title an optional title override for the imported collection
   * @returns the imported collection
   */
  public async importCollection(
    srcFilePath: string,
    targetDirPath: string,
    strategy: ImportStrategy,
    title?: string
  ): Promise<ImportResult> {
    // select importer
    const importer = this.importers.get(strategy);
    if (importer === undefined) {
      throw new InternalError(
        InternalErrorType.UNSUPPORTED_IMPORT_STRATEGY,
        `No importer registered for strategy "${strategy}"`
      );
    }

    // read and parse into Trufos collection
    logger.info(`Importing collection from "${srcFilePath}" using strategy "${strategy}"`);
    const collection = await importer.importCollection(srcFilePath);
    const warnings = importer.getWarnings?.() ?? [];

    // set directory
    collection.title = title || collection.title;
    const dirPath = await this.getCollectionDirPath(targetDirPath, collection.title);
    collection.dirPath = dirPath;
    const dirExistedBefore = await exists(dirPath);

    // serialize onto FS
    try {
      await persistenceService.saveCollection(collection, true);
    } catch (error) {
      await fs.rm(dirPath, { recursive: true, force: true }).catch(() => {});
      if (dirExistedBefore) await fs.mkdir(dirPath, { recursive: true }).catch(() => {});
      throw error;
    }

    logger.info('Successfully imported collection:', collection);
    return { collection, warnings };
  }

  /**
   * Determines the directory the imported collection is written to. An empty or missing target
   * directory becomes the collection directory itself, because nesting another directory inside
   * a directory that the user picked for this very import would not be useful. A used target
   * directory gets a subdirectory named after the collection, suffixed with a counter if that
   * name is taken, so that no existing data is ever overwritten.
   * @param targetDirPath the target directory of the import
   * @param title the title of the imported collection
   * @returns the directory to write the collection to, empty or not existing yet
   */
  private async getCollectionDirPath(targetDirPath: string, title: string) {
    if (await this.isUsableCollectionDir(targetDirPath)) return targetDirPath;

    const dirName = await uniqueNameAsync(
      sanitizeTitle(title),
      async (name) => !(await this.isUsableCollectionDir(path.join(targetDirPath, name)))
    );
    return path.join(targetDirPath, dirName);
  }

  /**
   * @param dirPath the directory to check
   * @returns true if the directory is empty or does not exist yet, false otherwise
   */
  private async isUsableCollectionDir(dirPath: string) {
    return await isEmpty(dirPath).catch(() => true);
  }
}

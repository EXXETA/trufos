import { InternalError, InternalErrorType } from 'main/error/internal-error';
import { Collection } from 'shim/objects/collection';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { PostmanImporter } from './postman-importer';
import { BrunoImporter } from './bruno-importer';
import { ImportStrategy } from 'shim/event-service';
import { sanitizeTitle } from 'shim/fs';
import path from 'path';

export interface ImportedScripts {
  preRequest?: string;
  postResponse?: string;
}

export interface CollectionImporter {
  /**
   * Reads a third-party collection from the given file or directory
   * @param srcFilePath the file or directory to read from
   */
  importCollection(srcFilePath: string): Promise<Collection>;
}

const persistenceService = PersistenceService.instance;

export class ImportService {
  public static readonly instance = new ImportService();

  static {
    ImportService.instance.registerImporter('Postman', new PostmanImporter());
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
  ) {
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

    // set directory
    collection.title = title || collection.title;
    collection.dirPath = path.join(targetDirPath, sanitizeTitle(collection.title));

    // save on file system
    logger.info('Successfully imported collection:', collection);
    await persistenceService.saveCollection(collection, true);
    return collection;
  }

  /**
   * Process imported scripts from third-party collections.
   * This is a placeholder for when Trufos implements script support.
   * Scripts will be handled here instead of in individual importers.
   *
   * @param scripts the scripts to process
   * @returns processed scripts in Trufos format (when implemented)
   */
  public processImportedScripts(scripts: ImportedScripts): ImportedScripts {
    logger.info('Processing imported scripts (not yet implemented in Trufos):', scripts);
    return scripts;
  }
}

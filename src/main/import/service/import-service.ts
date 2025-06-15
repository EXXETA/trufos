import { InternalError, InternalErrorType } from 'main/error/internal-error';
import { Collection } from 'shim/objects/collection';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { PostmanImporter } from './postman-importer';
import { BrunoImporter } from './bruno-importer';
import { CollectionType } from 'shim/objects/collection';

export interface CollectionImporter {
  /**
   * The type of collection this importer handles.
   */
  get type(): CollectionType;

  /**
   * Imports a collection from the specified source file path to the target directory path.
   * @param srcFilePath - The path to the source file containing the collection data.
   * @param targetDirPath - The path to the target directory where the collection will be imported.
   * @returns A promise that resolves to the imported collection.
   */
  importCollection(srcFilePath: string, targetDirPath: string): Promise<Collection>;
}

const persistenceService = PersistenceService.instance;

export class ImportService {
  public static readonly instance = new ImportService();

  static {
    ImportService.instance.registerImporter(new PostmanImporter());
    ImportService.instance.registerImporter(new BrunoImporter());
  }

  private readonly importers: Map<CollectionType, CollectionImporter> = new Map();

  public registerImporter(importer: CollectionImporter) {
    this.importers.set(importer.type, importer);
  }

  public async importCollection(
    srcFilePath: string,
    targetDirPath: string,
    strategy: CollectionType
  ) {
    const importer = this.importers.get(strategy);
    if (importer === undefined) {
      throw new InternalError(
        InternalErrorType.UNSUPPORTED_IMPORT_STRATEGY,
        `No importer registered for strategy "${strategy}"`
      );
    }

    logger.info(
      `Importing collection from "${srcFilePath}" to "${targetDirPath}" using strategy "${strategy}"`
    );
    const collection = await importer.importCollection(srcFilePath, targetDirPath);
    logger.info('Successfully imported collection:', collection);
    await persistenceService.saveCollectionRecursive(collection);
    return collection;
  }
}

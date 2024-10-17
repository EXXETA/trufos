import { InternalError, InternalErrorType } from 'main/error/internal-error';
import { Collection } from 'shim/objects/collection';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { PostmanImporter } from './postman-importer';

export type ImportStrategy = 'Postman' | 'Bruno' | 'Insomnia';

export interface CollectionImporter {
  importCollection(srcFilePath: string, targetDirPath: string): Promise<Collection>;
}

const persistenceService = PersistenceService.instance;

export class ImportService {

  public static readonly instance = new ImportService();

  static {
    ImportService.instance.registerImporter('Postman', new PostmanImporter());
  }

  private readonly importers: Map<ImportStrategy, CollectionImporter> = new Map();

  public registerImporter(strategy: ImportStrategy, importer: CollectionImporter) {
    this.importers.set(strategy, importer);
  }

  public async importCollection(srcFilePath: string, targetDirPath: string, strategy: ImportStrategy) {
    const importer = this.importers.get(strategy);
    if (importer === undefined) {
      throw new InternalError(InternalErrorType.UNSUPPORTED_IMPORT_STRATEGY, `No importer registered for strategy "${strategy}"`);
    }

    console.info(`Importing collection from "${srcFilePath}" to "${targetDirPath}" using strategy "${strategy}"`);
    const collection = await importer.importCollection(srcFilePath, targetDirPath);
    console.info('Successfully imported collection:', collection);
    await persistenceService.saveRecursive(collection);
    return collection;
  }

}
import { InternalError, InternalErrorType } from 'main/error/internal-error';
import type { ExportStrategy } from 'shim/event-service';
import { ZipExporter } from './zip-exporter';

export interface CollectionExporter {
  /**
   * Exports the collection at the given directory to the given target path.
   * @param dirPath the collection directory to read from
   * @param targetPath the file or directory to write the export to
   */
  exportCollection(dirPath: string, targetPath: string): Promise<void>;
}

export class ExportService {
  public static readonly instance = new ExportService();

  static {
    ExportService.instance.registerExporter('Zip', new ZipExporter());
  }

  private readonly exporters: Map<ExportStrategy, CollectionExporter> = new Map();

  public registerExporter(strategy: ExportStrategy, exporter: CollectionExporter) {
    this.exporters.set(strategy, exporter);
  }

  /**
   * Exports a Trufos collection to the given target path using the given strategy.
   * @param dirPath the collection directory to export
   * @param targetPath the file or directory to write the export to
   * @param strategy the export strategy to use (e.g. Zip)
   */
  public async exportCollection(dirPath: string, targetPath: string, strategy: ExportStrategy) {
    const exporter = this.exporters.get(strategy);
    if (exporter === undefined) {
      throw new InternalError(
        InternalErrorType.UNSUPPORTED_EXPORT_STRATEGY,
        `No exporter registered for strategy "${strategy}"`
      );
    }

    logger.info(`Exporting collection from "${dirPath}" to "${targetPath}" using "${strategy}"`);
    await exporter.exportCollection(dirPath, targetPath);
    logger.info(`Successfully exported collection to "${targetPath}"`);
  }
}

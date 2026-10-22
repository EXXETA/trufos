import { InternalError, InternalErrorType } from 'main/error/internal-error';
import type { ExportStrategy } from 'shim/event-service';
import { PluginService } from 'main/plugin/plugin-service';
import type { CollectionExporter, ExportOptions } from 'shim/plugin';
import { ZipExporter } from './zip-exporter';

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
   * @param strategy the export strategy to use (e.g. Zip), or the ID of an exporter of a plugin
   * @param options optional export settings (e.g. a password to encrypt the archive)
   */
  public async exportCollection(
    dirPath: string,
    targetPath: string,
    strategy: ExportStrategy,
    options?: ExportOptions
  ) {
    const exporter =
      this.exporters.get(strategy) ?? (await PluginService.instance.getExporter(strategy));
    if (exporter === undefined) {
      throw new InternalError(
        InternalErrorType.UNSUPPORTED_EXPORT_STRATEGY,
        `No exporter registered for strategy "${strategy}"`
      );
    }

    const encrypted = options?.password != null && options.password.length > 0;
    const suffix = [encrypted && 'encrypted', options?.includeSecrets && 'with secrets']
      .filter(Boolean)
      .join(', ');
    logger.info(
      `Exporting collection from "${dirPath}" to "${targetPath}" using "${strategy}"` +
        (suffix ? ` (${suffix})` : '')
    );
    await exporter.exportCollection(dirPath, targetPath, options);
    logger.info(`Successfully exported collection to "${targetPath}"`);
  }
}

import { describe, expect, it, vi } from 'vitest';
import { PluginService } from 'main/plugin/plugin-service';
import { InternalError } from 'main/error/internal-error';
import { ExportService } from './export-service';

describe('ExportService', () => {
  it('exports with an exporter of a plugin', async () => {
    const exporter = { exportCollection: vi.fn(async () => {}) };
    const getExporter = vi.spyOn(PluginService.instance, 'getExporter');
    getExporter.mockResolvedValueOnce(exporter);

    await ExportService.instance.exportCollection('/collection', '/export.json', 'my-plugin.x', {
      includeSecrets: true,
    });

    expect(getExporter).toHaveBeenCalledWith('my-plugin.x');
    expect(exporter.exportCollection).toHaveBeenCalledWith('/collection', '/export.json', {
      includeSecrets: true,
    });
  });

  it('throws if no exporter is registered for the strategy', async () => {
    vi.spyOn(PluginService.instance, 'getExporter').mockResolvedValueOnce(undefined);

    const action = ExportService.instance.exportCollection('/collection', '/out', 'unknown.x');

    await expect(action).rejects.toThrow(InternalError);
  });
});

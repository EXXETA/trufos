import { describe, expect, it, vi } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DisplayableError } from 'shim/error/DisplayableError';
import type { ImportStrategy } from 'shim/event-service';
import type { PluginInstance, PluginModule } from 'shim/plugin';
import testPluginManifest from '../../../plugins/__fixtures__/test-plugin/plugin.json';
import type { BundledPlugin } from './bundled-plugins';
import { PluginService, VERSION } from './plugin-service';

/** The fixture plugin, whose entry is only imported when the service loads it. */
function testPlugin(): BundledPlugin {
  return {
    manifest: testPluginManifest,
    load: vi.fn(() => import('../../../plugins/__fixtures__/test-plugin/src/main.js')),
  };
}

/** Implements the importer and the exporter of {@link fakePlugin}. */
function fakeInstance(): PluginInstance {
  return {
    importers: { x: { importCollection: vi.fn() } },
    exporters: { x: { exportCollection: vi.fn() } },
  };
}

/** A plugin with an importer and an exporter, both with the ID `x`. */
function fakePlugin(id: string, activate: PluginModule['activate'], engine = '^1.0.0') {
  return {
    manifest: {
      id,
      name: `Fake ${id}`,
      version: '1.0.0',
      engine,
      contributes: { importers: [{ id: 'x', name: 'X' }], exporters: [{ id: 'x', name: 'X' }] },
    },
    load: vi.fn(async () => ({ activate })),
  } satisfies BundledPlugin;
}

async function createService(...plugins: BundledPlugin[]) {
  const service = new PluginService(plugins);
  await service.init();
  return service;
}

describe('PluginService', () => {
  it('indexes the contributions from the manifests without loading the plugins', async () => {
    const plugin = testPlugin();
    const service = await createService(plugin);

    expect(service.contributions).toEqual({
      importers: [
        {
          id: 'test-plugin.title',
          pluginId: 'test-plugin',
          name: 'Title',
          source: 'file',
          extensions: ['json'],
        },
      ],
      exporters: [
        { id: 'test-plugin.title', pluginId: 'test-plugin', name: 'Title', extensions: ['json'] },
      ],
    });
    expect(plugin.load).not.toHaveBeenCalled();
  });

  it('loads a plugin on first use and activates it only once', async () => {
    const plugin = testPlugin();
    const service = await createService(plugin);
    const srcFilePath = path.join(tmpdir(), 'title.json');
    await writeFile(srcFilePath, JSON.stringify({ title: 'Imported' }));

    const importer = await service.getImporter('test-plugin.title');
    const collection = await importer?.importCollection(srcFilePath);
    await service.getExporter('test-plugin.title');

    expect(collection?.title).toBe('Imported');
    expect(plugin.load).toHaveBeenCalledOnce();
  });

  it('routes an exporter to the plugin', async () => {
    const service = await createService(testPlugin());
    const targetPath = path.join(tmpdir(), 'export.json');

    const exporter = await service.getExporter('test-plugin.title');
    await exporter?.exportCollection('/collection', targetPath);

    expect(JSON.parse(await readFile(targetPath, 'utf8'))).toEqual({ dirPath: '/collection' });
  });

  it.each<ImportStrategy>(['Postman', 'test-plugin.unknown', 'unknown.title'])(
    'returns no importer for "%s"',
    async (id) => {
      const plugin = testPlugin();
      const service = await createService(plugin);

      expect(await service.getImporter(id)).toBeUndefined();
      expect(plugin.load).not.toHaveBeenCalled();
    }
  );

  it('hands the plugin a host for its ID', async () => {
    const activate = vi.fn(fakeInstance);
    const service = await createService(fakePlugin('fake', activate));

    await service.getImporter('fake.x');

    expect(activate).toHaveBeenCalledWith({ pluginId: 'fake', log: expect.any(Object) });
  });

  it('lists the plugins from their manifests', async () => {
    const service = await createService(testPlugin());

    expect(service.pluginInfos).toEqual([
      {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: testPluginManifest.description,
        permissions: [],
        enabled: true,
        error: undefined,
      },
    ]);
  });

  it('can be initialized again', async () => {
    const service = await createService(testPlugin());

    await service.init();

    expect(service.pluginInfos).toEqual([
      expect.objectContaining({ id: 'test-plugin', error: undefined }),
    ]);
  });

  it('ignores a plugin with an invalid manifest', async () => {
    const service = await createService(
      { manifest: { id: 'Invalid' }, load: vi.fn() },
      testPlugin()
    );

    expect(service.pluginInfos.map(({ id }) => id)).toEqual(['test-plugin']);
  });

  it('disables a plugin that requires another plugin API version', async () => {
    const plugin = fakePlugin('future', () => ({}), '^2.0.0');
    const service = await createService(plugin);

    expect(service.pluginInfos).toEqual([
      expect.objectContaining({ id: 'future', error: expect.stringContaining('^2.0.0') }),
    ]);
    expect(service.contributions.importers).toEqual([]);
    expect(await service.getImporter('future.x')).toBeUndefined();
  });

  it('ignores a plugin with the ID of another plugin', async () => {
    const second = testPlugin();
    const service = await createService(testPlugin(), second);

    expect(service.pluginInfos).toEqual([
      expect.objectContaining({ id: 'test-plugin', error: undefined }),
    ]);
    expect(service.contributions.importers).toHaveLength(1);
    await service.getImporter('test-plugin.title');
    expect(second.load).not.toHaveBeenCalled();
  });

  it('takes a snapshot of the plugins and their contributions', async () => {
    const service = await createService(testPlugin());

    expect(service.snapshot).toEqual({
      plugins: service.pluginInfos,
      contributions: service.contributions,
    });
  });

  it('disables a plugin for the session if its activation fails', async () => {
    const plugin = fakePlugin('broken', () => {
      throw new Error('boom');
    });
    const service = await createService(plugin);
    const changed = vi.fn();
    service.on('changed', changed);

    await expect(service.getImporter('broken.x')).rejects.toThrow(DisplayableError);

    expect(changed).toHaveBeenCalledOnce();
    expect(service.pluginInfos[0].error).toContain('boom');
    expect(service.contributions.importers).toEqual([]);
    expect(await service.getImporter('broken.x')).toBeUndefined();
    expect(plugin.load).toHaveBeenCalledOnce();
  });

  it('rejects a plugin module without an activate() function', async () => {
    const service = await createService({
      manifest: testPluginManifest,
      // @ts-expect-error a plugin built against another API may export anything
      load: async () => ({}),
    });

    await expect(service.getImporter('test-plugin.title')).rejects.toThrow(DisplayableError);
    expect(service.pluginInfos[0].error).toContain('activate()');
  });

  it('throws if a plugin does not implement a contribution of its manifest', async () => {
    const service = await createService(fakePlugin('lazy', () => ({})));

    await expect(service.getImporter('lazy.x')).rejects.toThrow(DisplayableError);
  });

  it('turns an error of a plugin into a displayable error', async () => {
    const service = await createService(
      fakePlugin('failing', () => ({
        importers: {
          x: {
            importCollection: async () => {
              throw new Error('Unexpected token');
            },
            getWarnings: () => {
              throw new Error('boom');
            },
          },
        },
      }))
    );

    const importer = await service.getImporter('failing.x');

    await expect(importer?.importCollection('/file')).rejects.toMatchObject({
      title: 'Fake failing Plugin Error',
      description: 'Unexpected token',
    });
    expect(importer?.getWarnings?.()).toEqual([]);
  });

  it('rejects an invalid collection from an importer', async () => {
    const service = await createService(
      fakePlugin('invalid', () => ({
        importers: { x: { importCollection: async () => JSON.parse('{ "title": "No ID" }') } },
      }))
    );

    const importer = await service.getImporter('invalid.x');

    await expect(importer?.importCollection('/file')).rejects.toThrow('invalid');
  });

  it('disables and deactivates a plugin and stores the choice', async () => {
    const deactivate = vi.fn(async () => {});
    const service = await createService(
      fakePlugin('fake', () => ({ ...fakeInstance(), deactivate }))
    );
    const changed = vi.fn();
    service.on('changed', changed);
    await service.getImporter('fake.x');

    await service.setEnabled('fake', false);

    expect(deactivate).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledOnce();
    expect(service.contributions.importers).toEqual([]);
    expect(await service.getImporter('fake.x')).toBeUndefined();
    expect(JSON.parse(await readFile(PluginService.PLUGINS_FILE, 'utf8'))).toEqual({
      plugins: { fake: { enabled: false } },
      version: VERSION.string,
    });
  });

  it('keeps a plugin disabled after a restart', async () => {
    await writeFile(
      PluginService.PLUGINS_FILE,
      JSON.stringify({ version: VERSION.string, plugins: { 'test-plugin': { enabled: false } } })
    );

    const service = await createService(testPlugin());

    expect(service.pluginInfos[0].enabled).toBe(false);
    expect(service.contributions.importers).toEqual([]);
  });

  it('rejects enabling an unknown plugin', async () => {
    const service = await createService(testPlugin());

    await expect(service.setEnabled('unknown', false)).rejects.toThrow('No plugin found');
  });

  it('enables a disabled plugin', async () => {
    await writeFile(
      PluginService.PLUGINS_FILE,
      JSON.stringify({ version: VERSION.string, plugins: { 'test-plugin': { enabled: false } } })
    );
    const service = await createService(testPlugin());

    await service.setEnabled('test-plugin', true);

    expect(service.contributions.importers).toHaveLength(1);
  });

  it('does not fail when a plugin fails to deactivate', async () => {
    const deactivate = vi.fn(async () => {
      throw new Error('boom');
    });
    const service = await createService(
      fakePlugin('fake', () => ({ ...fakeInstance(), deactivate }))
    );
    await service.getImporter('fake.x');

    await expect(service.setEnabled('fake', false)).resolves.toBeUndefined();
  });
});

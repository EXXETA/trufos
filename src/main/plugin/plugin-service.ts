import path from 'node:path';
import { EventEmitter } from 'node:events';
import { z } from 'zod';
import { USER_DATA_DIR } from 'main/util/fs-util';
import { SemVer } from 'main/util/semver';
import { JsonFile } from 'main/persistence/json-file';
import { Initializable } from 'main/shared/initializable';
import { DisplayableError } from 'shim/error/DisplayableError';
import { Collection } from 'shim/objects/collection';
import type { ExportStrategy, ImportStrategy } from 'shim/event-service';
import {
  type CollectionExporter,
  type CollectionImporter,
  PLUGIN_API_VERSION,
  type PluginContributions,
  type PluginInfo,
  type PluginInstance,
  type PluginLogger,
  PluginManifest,
  qualifyId,
  splitQualifiedId,
} from 'shim/plugin';
import { BUNDLED_PLUGINS, type BundledPlugin } from './bundled-plugins';
import { createPluginHost, createPluginLogger } from './plugin-host';

export const VERSION = new SemVer(1, 0, 0);

const PluginsState = z.object({
  /** The state of each plugin by its ID. A plugin without an entry is enabled. */
  plugins: z.record(z.string(), z.object({ enabled: z.boolean() })).default({}),
});
type PluginsState = z.infer<typeof PluginsState>;

/** Event signatures emitted by the {@link PluginService}. */
type PluginServiceEvents = {
  /** The contributions changed, e.g. because a plugin was disabled. */
  changed: [];
};

/** The kinds of contributions a plugin implements in its {@link PluginInstance}. */
type ImplementedContribution = Exclude<keyof PluginInstance, 'deactivate'>;

/** The interface a plugin implements for each kind of contribution, derived from {@link PluginInstance}. */
type Implementations = {
  [K in ImplementedContribution]: NonNullable<PluginInstance[K]>[string];
};

/** A {@link PluginInstance} seen through its implementations, see {@link Implementations}. */
type ImplementingInstance = { [K in ImplementedContribution]?: Record<string, Implementations[K]> };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** A plugin with a valid manifest. */
interface Plugin {
  manifest: PluginManifest;
  load: BundledPlugin['load'];
  /** Logs messages about the plugin, with the same prefix as the plugin's own messages. */
  log: PluginLogger;
  /** Why the plugin cannot be used in this session, e.g. its activation failed. */
  error?: string;
  /** The activated plugin. Set on the first use of one of its contributions. */
  instance?: Promise<PluginInstance>;
}

/**
 * Finds the plugins, validates their manifests and keeps the index of their contributions. A
 * plugin's code is only loaded on the first use of one of its contributions: the index is built
 * from the manifests alone. Whether a plugin is enabled is kept in `plugins.json`.
 *
 * Every call into a plugin is guarded, so a failing plugin cannot take the app down: its errors are
 * logged with the plugin ID and surfaced as a {@link DisplayableError}. A plugin that fails to
 * activate is disabled for the session.
 */
export class PluginService extends EventEmitter<PluginServiceEvents> implements Initializable {
  public static readonly PLUGINS_FILE = path.join(USER_DATA_DIR, 'plugins.json');

  public static readonly instance = new PluginService(BUNDLED_PLUGINS);

  private readonly file = new JsonFile<PluginsState>({
    filePath: PluginService.PLUGINS_FILE,
    version: VERSION,
    schema: PluginsState,
  });

  private plugins: Plugin[] = [];

  /** @param bundled the plugins that ship with the app */
  constructor(private readonly bundled: readonly BundledPlugin[]) {
    super();
  }

  public async init(): Promise<void> {
    await this.file.init();
    this.plugins = [];
    for (const bundled of this.bundled) this.register(bundled);
  }

  /** All plugins with a valid manifest, whether they can be used or not. */
  public get pluginInfos(): PluginInfo[] {
    return this.plugins.map(({ manifest, error }) => ({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      enabled: this.isEnabled(manifest.id),
      error,
    }));
  }

  /** The contributions of all plugins that are enabled and can be used. */
  public get contributions(): PluginContributions {
    const manifests = this.plugins
      .filter((plugin) => this.isUsable(plugin))
      .map(({ manifest }) => manifest);
    const index = <T extends { id: string }>(manifest: PluginManifest, contribution: T) => ({
      ...contribution,
      id: qualifyId(manifest.id, contribution.id),
      pluginId: manifest.id,
    });
    return {
      importers: manifests.flatMap((m) => m.contributes.importers.map((c) => index(m, c))),
      exporters: manifests.flatMap((m) => m.contributes.exporters.map((c) => index(m, c))),
    };
  }

  /**
   * Enables or disables a plugin and stores the choice. A disabled plugin is deactivated.
   * @param id the ID of the plugin
   * @param enabled whether the plugin is enabled
   */
  public async setEnabled(id: string, enabled: boolean): Promise<void> {
    const plugin = this.plugins.find(({ manifest }) => manifest.id === id);
    if (plugin === undefined) throw new Error(`No plugin found with ID "${id}"`);
    if (this.isEnabled(id) === enabled) return;

    await this.file.update((draft) => {
      draft.plugins[id] = { enabled };
    });
    if (!enabled) await this.deactivate(plugin);
    this.emit('changed');
  }

  /**
   * Returns the importer contributed under the given ID, activating its plugin if needed.
   * @param id the qualified ID of the importer, see `QualifiedId`
   * @returns the importer, or undefined if no usable plugin contributes it
   * @throws if the plugin cannot be activated or does not implement the importer
   */
  public async getImporter(id: ImportStrategy): Promise<CollectionImporter | undefined> {
    const resolved = await this.resolve('importers', id);
    if (resolved === undefined) return undefined;
    const { plugin, implementation: importer } = resolved;
    return {
      importCollection: (srcFilePath) =>
        this.guard(plugin, async () => {
          const result = Collection.safeParse(await importer.importCollection(srcFilePath));
          if (result.success) return result.data;
          throw new Error(`The imported collection is invalid: ${z.prettifyError(result.error)}`);
        }),
      getWarnings: () => {
        try {
          return importer.getWarnings?.() ?? [];
        } catch (error) {
          plugin.log.error('Failed to return the import warnings:', error);
          return [];
        }
      },
    };
  }

  /**
   * Returns the exporter contributed under the given ID, activating its plugin if needed.
   * @param id the qualified ID of the exporter, see `QualifiedId`
   * @returns the exporter, or undefined if no usable plugin contributes it
   * @throws if the plugin cannot be activated or does not implement the exporter
   */
  public async getExporter(id: ExportStrategy): Promise<CollectionExporter | undefined> {
    const resolved = await this.resolve('exporters', id);
    if (resolved === undefined) return undefined;
    const { plugin, implementation: exporter } = resolved;
    return {
      exportCollection: (dirPath, targetPath, options) =>
        this.guard(plugin, () => exporter.exportCollection(dirPath, targetPath, options)),
    };
  }

  /** Validates the manifest of a plugin and adds it, disabled for the session if it is unusable. */
  private register({ manifest: rawManifest, load }: BundledPlugin) {
    const result = PluginManifest.safeParse(rawManifest);
    if (!result.success) {
      logger.error(`Ignoring a plugin with an invalid manifest: ${z.prettifyError(result.error)}`);
      return;
    }

    const manifest = result.data;
    const log = createPluginLogger(manifest.id);
    const error = this.whyUnusable(manifest);
    if (error !== undefined) log.error(`Disabled: ${error}`);
    this.plugins.push({ manifest, load, log, error });
  }

  /** @returns why a plugin with the given manifest cannot be used, or undefined if it can */
  private whyUnusable({ id, engine }: PluginManifest): string | undefined {
    if (this.plugins.some(({ manifest }) => manifest.id === id)) {
      return `Another plugin has the ID "${id}"`;
    }
    if (!SemVer.parse(PLUGIN_API_VERSION).satisfies(engine)) {
      return `Requires plugin API ${engine}, but the app provides ${PLUGIN_API_VERSION}`;
    }
    return undefined;
  }

  private isEnabled(id: string) {
    return this.file.value.plugins[id]?.enabled ?? true;
  }

  private isUsable(plugin: Plugin) {
    return plugin.error === undefined && this.isEnabled(plugin.manifest.id);
  }

  /**
   * Finds the usable plugin that contributes the given ID, activates it if needed and returns its
   * implementation of the contribution.
   * @param kind the kind of the contribution
   * @param id the qualified ID of the contribution
   * @returns the plugin and its implementation, or undefined if no usable plugin contributes the ID
   * @throws if the plugin cannot be activated or does not implement the contribution
   */
  private async resolve<K extends ImplementedContribution>(
    kind: K,
    id: string
  ): Promise<{ plugin: Plugin; implementation: Implementations[K] } | undefined> {
    const qualifiedId = splitQualifiedId(id);
    if (qualifiedId === undefined) return undefined;
    const { pluginId, contributionId } = qualifiedId;
    const plugin = this.plugins.find(
      (plugin) =>
        plugin.manifest.id === pluginId &&
        this.isUsable(plugin) &&
        plugin.manifest.contributes[kind].some(({ id }) => id === contributionId)
    );
    if (plugin === undefined) return undefined;

    const instance: ImplementingInstance = await this.activate(plugin);
    const implementation = instance[kind]?.[contributionId];
    if (implementation === undefined) {
      plugin.log.error(`Does not implement ${kind} "${contributionId}" of its manifest`);
      throw new DisplayableError(
        `The plugin "${plugin.manifest.name}" does not provide "${contributionId}".`,
        'Plugin Error'
      );
    }
    return { plugin, implementation };
  }

  /** Activates the plugin once. If that fails, the plugin is disabled for the session. */
  private activate(plugin: Plugin): Promise<PluginInstance> {
    plugin.instance ??= this.load(plugin).catch((error: unknown) => {
      plugin.log.error('Failed to activate:', error);
      plugin.error = `Activation failed: ${errorMessage(error)}`;
      this.emit('changed');
      throw new DisplayableError(
        `The plugin "${plugin.manifest.name}" could not be started. It is disabled until the app restarts.`,
        'Plugin Error',
        error
      );
    });
    return plugin.instance;
  }

  private async load({ manifest, load, log }: Plugin): Promise<PluginInstance> {
    log.info('Activating');
    const module = await load();
    if (typeof module?.activate !== 'function') {
      throw new Error('The plugin does not export an activate() function');
    }
    return await module.activate(createPluginHost(manifest));
  }

  private async deactivate(plugin: Plugin) {
    const instance = await plugin.instance?.catch(() => undefined);
    plugin.instance = undefined;
    if (instance?.deactivate === undefined) return;
    plugin.log.info('Deactivating');
    try {
      await instance.deactivate();
    } catch (error) {
      plugin.log.error('Failed to deactivate:', error);
    }
  }

  /** Runs a call into a plugin. A failure is logged and rethrown as a {@link DisplayableError}. */
  private async guard<T>(plugin: Plugin, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      plugin.log.error('Failed:', error);
      if (error instanceof DisplayableError) throw error;
      throw new DisplayableError(
        errorMessage(error),
        `${plugin.manifest.name} Plugin Error`,
        error
      );
    }
  }
}

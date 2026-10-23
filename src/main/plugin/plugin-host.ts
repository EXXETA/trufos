import fs from 'node:fs/promises';
import {
  type PluginFileSystem,
  type PluginHost,
  type PluginLogger,
  type PluginManifest,
  PluginPermissionScope,
} from 'shim/plugin';

/** Writes to the log of the app with the ID of the plugin in front of every message. */
export function createPluginLogger(pluginId: string): PluginLogger {
  const prefix = (message: string) => `[PLUGIN ${pluginId}]: ${message}`;
  return {
    debug: (message, ...meta) => logger.debug(prefix(message), ...meta),
    info: (message, ...meta) => logger.info(prefix(message), ...meta),
    warn: (message, ...meta) => logger.warn(prefix(message), ...meta),
    error: (message, ...meta) => logger.error(prefix(message), ...meta),
  };
}

// Node's functions accept more than the plugin API promises, so they are passed through as they are.
function createFileSystem(): PluginFileSystem {
  return { readdir: fs.readdir, stat: fs.stat, readFile: fs.readFile, writeFile: fs.writeFile };
}

/**
 * The host API of a plugin. Its capabilities are accessors of the class, so they live on the
 * prototype: they are not enumerable and take no part in spreading, logging or the diff of a
 * failed test, where a capability without its permission would throw.
 */
class Host implements PluginHost {
  readonly #fs: () => PluginFileSystem;

  constructor(
    readonly pluginId: string,
    readonly log: PluginLogger,
    manifest: PluginManifest
  ) {
    this.#fs = capability(manifest, PluginPermissionScope.FS, 'fs', createFileSystem);
    Object.freeze(this);
  }

  get fs() {
    return this.#fs();
  }
}

/**
 * Builds the host API for a plugin from its manifest. A capability is only provided if the
 * manifest declares a permission of its scope; otherwise it throws on access, naming the missing
 * permission. See {@link PluginHost}.
 * @param manifest the validated manifest of the plugin
 */
export function createPluginHost(manifest: PluginManifest): PluginHost {
  return new Host(manifest.id, Object.freeze(createPluginLogger(manifest.id)), manifest);
}

/**
 * @param manifest the manifest of the plugin
 * @param scope the permission scope that grants the capability
 * @param name the name of the capability on the host
 * @param create creates the capability
 * @returns the capability if the manifest declares a permission of its scope, else a function
 * that throws
 */
function capability<T extends object>(
  manifest: PluginManifest,
  scope: PluginPermissionScope,
  name: keyof PluginHost,
  create: () => T
): () => T {
  if (!manifest.permissions.some((permission) => permission.scope === scope)) {
    return () => {
      throw new Error(
        `The plugin "${manifest.id}" uses host.${name}, but its manifest declares no "${scope}" permission`
      );
    };
  }
  const instance = Object.freeze(create());
  return () => instance;
}

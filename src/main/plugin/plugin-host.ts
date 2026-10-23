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

/** The parts of the host that need a permission. */
type Capability = Exclude<keyof PluginHost, 'pluginId' | 'log'>;

/** Each capability with the permission scope that grants it and how it is created. */
const CAPABILITIES: {
  [K in Capability]: { scope: PluginPermissionScope; create(): PluginHost[K] };
} = {
  fs: { scope: PluginPermissionScope.FS, create: createFileSystem },
};

/**
 * Builds the host API for a plugin from its manifest. A capability is only provided if the
 * manifest declares a permission of its scope; otherwise it throws on access, naming the missing
 * permission. See {@link PluginHost}.
 * @param manifest the validated manifest of the plugin
 */
export function createPluginHost(manifest: PluginManifest): PluginHost {
  const fs = capability(manifest, 'fs');
  const host: PluginHost = {
    pluginId: manifest.id,
    log: Object.freeze(createPluginLogger(manifest.id)),
    get fs() {
      return fs();
    },
  };
  // a capability may throw, so none takes part in spreading, logging or the diff of a failed test
  for (const name of Object.keys(CAPABILITIES)) {
    Object.defineProperty(host, name, { enumerable: false });
  }
  return Object.freeze(host);
}

/**
 * @param manifest the manifest of the plugin
 * @param name the capability
 * @returns the capability if the manifest declares a permission of its scope, else a function
 * that throws
 */
function capability<K extends Capability>(manifest: PluginManifest, name: K): () => PluginHost[K] {
  const { scope, create } = CAPABILITIES[name];
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

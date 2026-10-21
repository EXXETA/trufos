import type { PluginHost, PluginLogger, PluginManifest } from 'shim/plugin';

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

/**
 * Builds the host API for a plugin from its manifest. A part that needs a permission is only added
 * if the manifest declares the permission. No part needs one yet: each is added together with the
 * first contribution that uses it.
 * @param manifest the validated manifest of the plugin
 */
export function createPluginHost(manifest: PluginManifest): PluginHost {
  return Object.freeze({
    pluginId: manifest.id,
    log: Object.freeze(createPluginLogger(manifest.id)),
  });
}

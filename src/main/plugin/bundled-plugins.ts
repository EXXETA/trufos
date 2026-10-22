import type { PluginModule } from 'shim/plugin';
import postmanManifest from 'plugins/postman/plugin.json';

/** A plugin that ships with the app. */
export interface BundledPlugin {
  /**
   * The content of the plugin's `plugin.json`. A JSON import widens every value to `string`, so it
   * is validated when the plugins are loaded instead of typed. The tests validate the manifests of
   * all bundled plugins, so a mistake fails the build anyway.
   */
  manifest: unknown;

  /**
   * Imports the main-process entry of the plugin. Called on the first use of one of its
   * contributions only. A dynamic `import()` here makes Vite put the plugin into its own chunk, so
   * a bundled plugin costs nothing at startup.
   */
  load(): Promise<PluginModule>;
}

/** The plugins that ship with the app. */
export const BUNDLED_PLUGINS: readonly BundledPlugin[] = [
  { manifest: postmanManifest, load: () => import('plugins/postman/src/main.js') },
];

import type { PluginActivate } from 'shim/plugin';
import { PostmanImporter } from './postman-importer';

export const activate: PluginActivate = (host) => ({
  importers: { collection: new PostmanImporter(host.log) },
});

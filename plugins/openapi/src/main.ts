import type { PluginActivate } from 'shim/plugin';
import { OpenApiImporter } from './openapi-importer';

export const activate: PluginActivate = (host) => ({
  importers: { document: new OpenApiImporter(host.log) },
});

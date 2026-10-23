import type { PluginActivate } from 'shim/plugin';
import { BrunoImporter } from './bruno-importer';

export const activate: PluginActivate = (host) => ({
  importers: { collection: new BrunoImporter(host.log, host.fs) },
});

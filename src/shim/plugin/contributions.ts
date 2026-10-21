import type { ExporterContribution, ImporterContribution } from './manifest';

/**
 * The ID of a contribution outside its plugin: the ID of the plugin and the ID of the contribution
 * in the plugin's manifest, joined with a dot, e.g. `postman.collection`. Built-in IDs never
 * contain a dot, so they cannot collide with plugin contributions.
 */
export type QualifiedId = `${string}.${string}`;

/**
 * @param pluginId the ID of the plugin
 * @param contributionId the ID of the contribution in the plugin's manifest
 * @returns the ID of the contribution outside its plugin
 */
export function qualifyId(pluginId: string, contributionId: string): QualifiedId {
  return `${pluginId}.${contributionId}`;
}

/**
 * @param id an ID that may be a {@link QualifiedId}
 * @returns the ID of the plugin and of the contribution, or undefined if the ID is not qualified
 */
export function splitQualifiedId(
  id: string
): { pluginId: string; contributionId: string } | undefined {
  const index = id.indexOf('.');
  if (index === -1) return undefined;
  return { pluginId: id.slice(0, index), contributionId: id.slice(index + 1) };
}

/** A contribution of an enabled plugin, as the app lists it. */
type IndexedContribution<T extends { id: string }> = Omit<T, 'id'> & {
  id: QualifiedId;
  pluginId: string;
};

export type IndexedImporter = IndexedContribution<ImporterContribution>;
export type IndexedExporter = IndexedContribution<ExporterContribution>;

/** What the app knows about a plugin without loading it. */
export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  /** Why the plugin cannot be used in this session, e.g. its activation failed. */
  error?: string;
}

/** The contributions of all enabled plugins, built from their manifests. */
export interface PluginContributions {
  importers: IndexedImporter[];
  exporters: IndexedExporter[];
}

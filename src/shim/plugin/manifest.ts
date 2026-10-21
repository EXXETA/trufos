import { z } from 'zod';

/**
 * The ID of a plugin or of one of its contributions. A contribution is addressed outside its
 * plugin by a {@link QualifiedId}.
 */
export const PluginId = z.string().regex(/^[a-z][a-z0-9-]*$/);
export type PluginId = z.infer<typeof PluginId>;

/** A host name, optionally with a leading wildcard label, e.g. `api.github.com` or `*.github.com`. */
const HostPattern = z.string().regex(/^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/);

/** The name of an executable, e.g. `git`. */
const BinaryName = z.string().regex(/^[\w.-]+$/);

/**
 * A permission a plugin declares in its manifest. The host API handed to a plugin is built from
 * its permissions, so a plugin only gets the parts of it that it declared.
 */
export const PluginPermission = z.union([
  z.enum([
    'collection:read',
    'collection:write',
    'bodies:read',
    'fs:collection',
    'fs:pick',
    'secrets',
  ]),
  z.templateLiteral(['network:', HostPattern]),
  z.templateLiteral(['exec:', BinaryName]),
]);
export type PluginPermission = z.infer<typeof PluginPermission>;

/** An importer that reads a collection of another tool. */
export const ImporterContribution = z.strictObject({
  id: PluginId,
  /** The name shown to the user, usually the name of the other tool. */
  name: z.string().min(1),
  /** Whether the importer reads a single file or a directory. */
  source: z.enum(['file', 'directory']).default('file'),
  /** The file extensions the importer reads, without a leading dot. Only used for files. */
  extensions: z.array(z.string().regex(/^[\w-]+$/)).default([]),
});
export type ImporterContribution = z.infer<typeof ImporterContribution>;

/** An exporter that writes a collection into a file of another format. */
export const ExporterContribution = z.strictObject({
  id: PluginId,
  /** The name shown to the user, usually the name of the format. */
  name: z.string().min(1),
  /** The file extensions of the written file, without a leading dot. */
  extensions: z.array(z.string().regex(/^[\w-]+$/)).default([]),
});
export type ExporterContribution = z.infer<typeof ExporterContribution>;

/** Contributions with a duplicate ID would be ambiguous. */
function hasUniqueIds(contributions: { id: string }[]) {
  return new Set(contributions.map(({ id }) => id)).size === contributions.length;
}

/**
 * What a plugin adds to the app. It is known from the manifest alone, so the app can list and
 * render the contributions without loading the plugin.
 */
export const PluginContributes = z.strictObject({
  importers: z
    .array(ImporterContribution)
    .refine(hasUniqueIds, 'Duplicate importer ID')
    .default([]),
  exporters: z
    .array(ExporterContribution)
    .refine(hasUniqueIds, 'Duplicate exporter ID')
    .default([]),
});
export type PluginContributes = z.infer<typeof PluginContributes>;

/**
 * The manifest of a plugin, its `plugin.json`. The app reads it without running any code of the
 * plugin. `plugin-manifest.schema.json` is generated from this schema, so editors can validate a
 * manifest that references it with `$schema`. Unknown keys are rejected, so a misspelled key is
 * not silently ignored; a manifest that uses keys of a newer API has to require it with `engine`.
 */
export const PluginManifest = z.strictObject({
  /** The JSON Schema the manifest is written against. Only used by editors. */
  $schema: z.string().optional(),
  id: PluginId,
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().default(''),
  /**
   * The versions of the plugin API the plugin works with, see `PLUGIN_API_VERSION`. Either an
   * exact version (`1.2.3`) or a caret range (`^1.2.3`).
   */
  engine: z.string().regex(/^\^?\d+\.\d+\.\d+$/),
  permissions: z.array(PluginPermission).default([]),
  contributes: PluginContributes.default({ importers: [], exporters: [] }),
});
export type PluginManifest = z.infer<typeof PluginManifest>;

import type { Collection } from '../objects/collection';

/** A problem with a part of an imported collection that was skipped or imported partially. */
export interface ImportWarning {
  message: string;
  filePath?: string;
  itemName?: string;
  itemType?: string;
}

export interface ExportOptions {
  /** When set, the archive is encrypted with AES-256 using this password. */
  password?: string;
  /**
   * When true, each object's secrets (secret variables and auth) are decrypted from their
   * `.secrets.bin` file and written into the archive as plaintext JSON. Independent of `password`.
   */
  includeSecrets?: boolean;
}

export interface CollectionImporter {
  /**
   * Reads a third-party collection from the given file or directory
   * @param srcFilePath the file or directory to read from
   */
  importCollection(srcFilePath: string): Promise<Collection>;
  getWarnings?(): ImportWarning[];
}

export interface CollectionExporter {
  /**
   * Exports the collection at the given directory to the given target path.
   * @param dirPath the collection directory to read from
   * @param targetPath the file or directory to write the export to
   * @param options optional export settings (e.g. a password to encrypt the archive)
   */
  exportCollection(dirPath: string, targetPath: string, options?: ExportOptions): Promise<void>;
}

/** Writes to the log of the app. Every message is marked with the ID of the plugin. */
export interface PluginLogger {
  debug(message: string, ...meta: unknown[]): void;
  info(message: string, ...meta: unknown[]): void;
  warn(message: string, ...meta: unknown[]): void;
  error(message: string, ...meta: unknown[]): void;
}

/**
 * What a plugin gets from the app when it is activated. It is built from the permissions in the
 * manifest: a part that needs a permission is only present if the plugin declared it. Every call
 * takes and returns plain data, so the host can be moved behind a process boundary later.
 */
export interface PluginHost {
  /** The ID of the plugin the host was built for. */
  readonly pluginId: string;
  readonly log: PluginLogger;
}

/**
 * The implementation of the contributions a plugin declared in its manifest, keyed by the ID of
 * each contribution in the manifest.
 */
export interface PluginInstance {
  importers?: Record<string, CollectionImporter>;
  exporters?: Record<string, CollectionExporter>;
  /** Called when the plugin is disabled. Releases everything the plugin acquired. */
  deactivate?(): Promise<void>;
}

/** Activates a plugin. Called once, on the first use of one of its contributions. */
export type PluginActivate = (host: PluginHost) => Promise<PluginInstance> | PluginInstance;

/** The main-process entry of a plugin. */
export interface PluginModule {
  activate: PluginActivate;
}

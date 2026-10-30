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
   * @param reportWarning receives the problems of this import. Imports can run concurrently, so an
   * importer keeps nothing about an import in its own state.
   */
  importCollection(
    srcFilePath: string,
    reportWarning?: (warning: ImportWarning) => void
  ): Promise<Collection>;
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

/** An entry of a directory, the part of Node's `fs.Dirent` a plugin gets. */
export interface PluginDirent {
  readonly name: string;
  isFile(): boolean;
  isDirectory(): boolean;
}

/** What is known about a file, the part of Node's `fs.Stats` a plugin gets. */
export interface PluginStats {
  readonly size: number;
  isFile(): boolean;
  isDirectory(): boolean;
}

/**
 * Reads and writes files for a plugin. Granted by a permission of the `fs` scope. Access is not
 * limited to the files of the {@link PluginFileArea} yet, so it reaches every file of the user.
 *
 * Every method mirrors the signature of its namesake in Node's `fs/promises`, with the subset of
 * options that is plain data, and binary data typed as `Uint8Array` instead of `Buffer`. Methods
 * that return handles or watchers are not mirrored. New methods are added with the first plugin
 * that needs them. Only content that has to be in memory anyway, such as a collection to import,
 * is read as a whole.
 */
export interface PluginFileSystem {
  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<PluginDirent[]>;
  stat(path: string): Promise<PluginStats>;
  readFile(path: string, options?: { encoding?: null; signal?: AbortSignal }): Promise<Uint8Array>;
  readFile(
    path: string,
    options: BufferEncoding | { encoding: BufferEncoding; signal?: AbortSignal }
  ): Promise<string>;
  writeFile(
    path: string,
    data: string | Uint8Array,
    options?: BufferEncoding | { encoding?: BufferEncoding; signal?: AbortSignal }
  ): Promise<void>;
}

/**
 * What a plugin gets from the app when it is activated. Every call takes and returns plain data,
 * so the host can be moved behind a process boundary later. The host itself is a capability
 * object, not data: it is not meant to be spread, serialized or passed on. Its capabilities are
 * not enumerable.
 *
 * Everything that reaches outside the app is a capability of the host, and the host is built from
 * the permissions in the manifest: a capability whose permission the manifest does not declare
 * throws on access. A lint rule catches the accidental use of Node's own modules or the global
 * `fetch` in plugin code instead; it is a reminder, not a boundary. A plugin takes the
 * capabilities it needs in `activate()`, so a missing permission fails the activation test of the
 * bundled plugins instead of a user's action.
 */
export interface PluginHost {
  /** The ID of the plugin the host was built for. */
  readonly pluginId: string;
  readonly log: PluginLogger;
  /** Needs `fs:collection` or `fs:pick`. */
  readonly fs: PluginFileSystem;
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

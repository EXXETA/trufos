import { readFile } from 'node:fs/promises';
import { type Draft, freeze, type Immutable, produce } from 'immer';
import { z } from 'zod';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { Initializable } from 'main/shared/initializable';
import { exists } from 'main/util/fs-util';
import { SemVer } from 'main/util/semver';
import { SerialQueue } from 'main/util/serial-queue';

/** Any version of a JSON file. Only the version is known before it is migrated. */
const VersionedFile = z.looseObject({ version: z.string() });
export type VersionedFile = z.infer<typeof VersionedFile>;

/**
 * Migrates the content of a JSON file to the next version. Its input is not validated, it is only
 * known to have the version the migrator is registered for, so a migrator validates the fields it
 * reads itself.
 */
export type JsonFileMigrator = (old: VersionedFile) => VersionedFile;

export interface JsonFileOptions<T> {
  /** The path of the file. */
  filePath: string;

  /** The version of the current file format. */
  version: SemVer;

  /**
   * The schema of the content in the current version, without the version. It must accept an
   * empty object, which is parsed into the content of a new file.
   */
  schema: z.ZodType<T>;

  /** Migrates the content from the version it is registered for to the next version. */
  migrators?: Readonly<Record<string, JsonFileMigrator>>;
}

/**
 * A JSON file of the application, e.g. the settings, that is kept in memory. Its content is
 * migrated from older versions when it is read, and validated with a Zod schema whenever it is read
 * or changed, so rules of the schema, e.g. transforms, apply to every change. The content in
 * memory is immutable; every change replaces it and writes the file. Use it as a private field of
 * a service that offers the operations on the content.
 *
 * Reading and writing run one after another, so a write cannot interleave with a read or finish
 * after a later write. The file is replaced atomically, so a crash cannot leave it half-written.
 * It has to be initialized before it is used: {@link init} replaces the content with the file's.
 */
export class JsonFile<T> implements Initializable {
  /** The current content. It is deeply frozen, so it can be handed out without a copy. */
  private _value: T;

  /** Reads and writes the file one at a time. */
  private readonly queue = new SerialQueue();

  constructor(private readonly options: JsonFileOptions<T>) {
    this._value = this.defaultValue();
  }

  /** The current content of the file. */
  public get value(): Immutable<T> {
    // the value is deeply frozen, see _value; TypeScript cannot relate T to Immutable<T> itself
    return this._value as Immutable<T>;
  }

  /**
   * Reads the file. If there is none, it is created with the default content. If it is invalid,
   * it is replaced with the default content.
   * @throws if the file has a version that cannot be migrated
   */
  public init(): Promise<void> {
    return this.queue.run(async () => {
      const { filePath } = this.options;
      if (!(await exists(filePath))) {
        logger.info(`No file found at ${filePath}. Creating it with the default content.`);
        this._value = this.defaultValue();
        await this.writeFile();
        return;
      }

      try {
        this._value = this.parse(await readFile(filePath, 'utf8'));
      } catch (error) {
        if (!(error instanceof SyntaxError) && !(error instanceof z.ZodError)) throw error;
        logger.warn(`The file at ${filePath} is invalid. Replacing it with the default.`, error);
        this._value = this.defaultValue();
        await this.writeFile();
      }
    });
  }

  /**
   * Replaces the content and writes the file.
   * @returns resolves once the file has this content or a newer one. Rejects without changing
   * anything if the content is invalid.
   */
  public async set(value: T): Promise<void> {
    this._value = this.validate(value);
    await this.write();
  }

  /**
   * Changes the content with an Immer recipe and writes the file. Nothing is written if the recipe
   * changes nothing.
   * @returns resolves once the file has this content or a newer one. Rejects without changing
   * anything if the changed content is invalid.
   */
  public async update(recipe: (draft: Draft<T>) => void): Promise<void> {
    const value = produce(this._value, recipe);
    if (value === this._value) return;
    this._value = this.validate(value);
    await this.write();
  }

  /** Queues writing the file. It gets the content as it is when the write starts. */
  private write(): Promise<void> {
    return this.queue.run(() => this.writeFile());
  }

  private writeFile(): Promise<void> {
    const content = { ...this._value, version: this.options.version.string };
    return FileSystemService.instance.replaceFile(
      this.options.filePath,
      JSON.stringify(content, null, 2)
    );
  }

  /** Parses, migrates and validates the content of the file. */
  private parse(text: string): T {
    let file = VersionedFile.parse(JSON.parse(text));
    while (file.version !== this.options.version.string) {
      const migrator = this.options.migrators?.[file.version];
      if (migrator == null) throw new Error(`No migrator found for version ${file.version}`);
      file = migrator(file);
    }
    const { version: _version, ...content } = file;
    return this.validate(content);
  }

  /** Validates the content, applying the rules of the schema, and freezes the result. */
  private validate(content: unknown): T {
    return freeze(this.options.schema.parse(content), true);
  }

  private defaultValue(): T {
    return this.validate({});
  }
}

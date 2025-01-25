import { InfoFile } from './latest';

export type VersionedObject = { version: string };

/**
 * Maps one schema of an info file to another. Usually, this is used to migrate info files from the previous version to the current version.
 *
 * @typeParam I - The input schema of the info file.
 * @typeParam O - The output schema of the info file. Defaults to the latest schema.
 */
export abstract class InfoFileMapper<
  I extends VersionedObject,
  O extends VersionedObject = InfoFile,
> {
  /** The version of the schema the mapper migrates from. */
  public abstract readonly fromVersion: I['version'];

  /**
   * Migrates the given info file to the implementation's schema.
   * @param old The info file to migrate.
   */
  abstract migrate(old: I): Promise<O>;
}

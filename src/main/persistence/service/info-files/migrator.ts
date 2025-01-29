import { InfoFile } from './latest';
import { SemVerString } from 'main/util/semver';

export type VersionedObject = { version: SemVerString };

/**
 * Maps one schema of an info file to another. Usually, this is used to migrate info files from the previous version to the current version.
 *
 * @typeParam I - The input schema of the info file.
 * @typeParam O - The output schema of the info file. Defaults to the latest schema.
 */
export abstract class AbstractInfoFileMigrator<
  I extends VersionedObject,
  O extends VersionedObject = InfoFile,
> {
  /** The version of the schema the migrator migrates from. */
  public abstract readonly fromVersion: I['version'];

  /**
   * Migrates the given info file to the implementation's schema.
   * @param old The info file to migrate.
   */
  abstract migrate(old: I): Promise<O>;
}

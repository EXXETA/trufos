import { AbstractInfoFileMigrator, VersionedObject } from './migrator';
import { InfoFile, VERSION as LATEST_VERSION } from './latest';
import { InfoFileMigrator as V1_0_1 } from './v1-0-1';

// add new mappers here
const MIGRATOR_ARRAY = [new V1_0_1()];

const MIGRATORS = new Map<string, AbstractInfoFileMigrator<VersionedObject, VersionedObject>>(
  MIGRATOR_ARRAY.map((mapper) => [mapper.fromVersion, mapper])
);

/**
 * Migrates the given info file to the latest schema and removes the version property.
 * @param infoFile The info file to migrate.
 */

export async function migrateInfoFile(infoFile: VersionedObject) {
  while (infoFile.version !== LATEST_VERSION.toString()) {
    console.debug(`Looking for mapper for source version ${infoFile.version}`);
    const mapper = MIGRATORS.get(infoFile.version);
    if (!mapper) throw new Error(`No mapper found for version ${infoFile.version}`);
    const oldVersion = infoFile.version;
    infoFile = await mapper.migrate(infoFile);
    console.info(`Migrated from version ${oldVersion} to ${infoFile.version}`);
    if (oldVersion === infoFile.version) {
      throw new Error(`Mapper for version ${infoFile.version} did not change the version`);
    }
  }

  delete infoFile.version;
  return infoFile as InfoFile as Omit<InfoFile, 'version'>;
}

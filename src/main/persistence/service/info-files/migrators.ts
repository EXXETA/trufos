import { TrufosObjectType } from 'shim/objects';
import { AbstractInfoFileMigrator, VersionedObject } from './migrator';
import { InfoFile, VERSION as LATEST_VERSION } from './latest';
import { InfoFileMigrator as V1_0_1 } from './v1-0-1';
import { InfoFileMigrator as V1_1_0 } from './v1-1-0';
import { InfoFileMigrator as V1_2_0 } from './v1-2-0';

// add new mappers here
const MIGRATOR_ARRAY = [new V1_0_1(), new V1_1_0(), new V1_2_0()];

const MIGRATORS = new Map<string, AbstractInfoFileMigrator<VersionedObject, VersionedObject>>(
  MIGRATOR_ARRAY.map((mapper) => [mapper.fromVersion, mapper])
);

/**
 * Migrates the given info file to the latest schema and removes the version property.
 * @param infoFile The info file to migrate.
 * @param type The type of the info file.
 */

export async function migrateInfoFile(infoFile: VersionedObject, type: TrufosObjectType) {
  while (infoFile.version !== LATEST_VERSION.toString()) {
    logger.debug(`Looking for mapper for source version ${infoFile.version}`);
    const mapper = MIGRATORS.get(infoFile.version);
    if (!mapper) throw new Error(`No mapper found for version ${infoFile.version}`);
    const oldVersion = infoFile.version;
    infoFile = await mapper.migrate(infoFile, type);
    logger.info(`Migrated from version ${oldVersion} to ${infoFile.version}`);
    if (oldVersion === infoFile.version) {
      throw new Error(`Mapper for version ${infoFile.version} did not change the version`);
    }
  }

  delete infoFile.version;
  return infoFile as InfoFile as Omit<InfoFile, 'version'>;
}

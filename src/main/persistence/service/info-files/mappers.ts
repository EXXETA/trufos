import { InfoFileMapper, VersionedObject } from './mapper';
import { InfoFile, VERSION as LATEST_VERSION } from './latest';
import { InfoFileMapperV1_0_0 } from './v1-0-0';

const MAPPERS = new Map<string, InfoFileMapper<VersionedObject, VersionedObject>>(
  [new InfoFileMapperV1_0_0()].map((mapper) => [mapper.fromVersion, mapper])
);

/**
 * Migrates the given info file to the latest schema and removes the version property.
 * @param infoFile The info file to migrate.
 */

export async function migrateInfoFile(infoFile: VersionedObject) {
  while (infoFile.version !== LATEST_VERSION.toString()) {
    console.debug(`Looking for mapper for source version ${infoFile.version}`);
    const mapper = MAPPERS.get(infoFile.version);
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

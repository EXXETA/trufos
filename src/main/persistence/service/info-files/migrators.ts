import { TrufosObjectType } from 'shim/objects';
import { AbstractInfoFileMigrator, VersionedObject } from './migrator';
import { InfoFile, VERSION as LATEST_VERSION } from './latest';
import { InfoFileMigrator as V1_0_1 } from './v1-0-1';
import { InfoFileMigrator as V1_1_0 } from './v1-1-0';
import { InfoFileMigrator as V1_2_0 } from './v1-2-0';
import { InfoFileMigrator as V1_3_0 } from './v1-3-0';
import { InfoFileMigrator as V1_4_0 } from './v1-4-0';
import { InfoFileMigrator as V2_0_0 } from './v2-0-0';
import { InfoFileMigrator as V2_1_0 } from './v2-1-0';
import { InfoFileMigrator as V2_2_0 } from './v2-2-0';
import { SemVer } from 'main/util/semver';

// add new migrators here
const MIGRATOR_ARRAY = [
  new V1_0_1(),
  new V1_1_0(),
  new V1_2_0(),
  new V1_3_0(),
  new V1_4_0(),
  new V2_0_0(),
  new V2_1_0(),
  new V2_2_0(),
];

const MIGRATORS = new Map<string, AbstractInfoFileMigrator<VersionedObject, VersionedObject>>(
  MIGRATOR_ARRAY.map((mapper) => [mapper.fromVersion, mapper])
);

/**
 * Migrates the given info file to the latest schema and removes the version property.
 * @param infoFile The info file to migrate.
 * @param type The type of the info file.
 * @param filePath The path to the info file.
 */
export async function migrateInfoFile(
  infoFile: VersionedObject,
  type: TrufosObjectType,
  filePath: string
): Promise<InfoFile> {
  // check if the version is supported
  if (SemVer.parse(infoFile.version).isNewerThan(LATEST_VERSION)) {
    throw new Error(
      `The version of the loaded ${type} info file is newer than latest supported version ${LATEST_VERSION}. Please update the application.`
    );
  }

  // migrate until latest version is reached
  while (infoFile.version !== LATEST_VERSION.toString()) {
    logger.debug(`Looking for migrator for source version ${infoFile.version}`);
    const migrator = MIGRATORS.get(infoFile.version);
    if (!migrator) throw new Error(`No migrator found for version ${infoFile.version}`);
    const oldVersion = infoFile.version;
    infoFile = await migrator.migrate(infoFile, type, filePath);
    logger.info(`Migrated from version ${oldVersion} to ${infoFile.version}`);
    if (oldVersion === infoFile.version) {
      throw new Error(`Migrator for version ${infoFile.version} did not change the version`);
    }
  }

  return infoFile as InfoFile;
}

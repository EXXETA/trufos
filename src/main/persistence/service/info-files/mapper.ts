import { InfoFile, VERSION } from './latest';

type InfoFileBase = {
  version: string;
};

/**
 * Maps one schema of an info file to another. Usually, this is used to migrate info files from the previous version to the current version.
 *
 * @typeParam I - The input schema of the info file.
 * @typeParam O - The output schema of the info file. Defaults to the latest schema.
 */
export abstract class InfoFileMapper<I extends InfoFileBase, O extends InfoFileBase = InfoFile> {
  /** All registered info file mappers. */
  private static readonly mappers = new Map<string, InfoFileMapper<InfoFileBase, InfoFileBase>>();

  /** The version of the schema the mapper migrates from. */
  public abstract readonly fromVersion: I['version'];

  /**
   * Migrates the given info file to the implementation's schema.
   * @param old The info file to migrate.
   */
  abstract migrate(old: I): Promise<O>;

  /**
   * Registers the given mapper.
   * @param mapper The mapper to register.
   */
  protected static registerMapper<I extends InfoFileBase, O extends InfoFileBase>(
    mapper: InfoFileMapper<I, O>
  ) {
    InfoFileMapper.mappers.set(mapper.fromVersion, mapper);
  }

  /**
   * Migrates the given info file to the latest schema and removes the version property.
   * @param infoFile The info file to migrate.
   */
  public static async migrate(infoFile: InfoFileBase) {
    while (infoFile.version !== VERSION) {
      console.debug(`Looking for mapper for source version ${infoFile.version}`);
      const mapper = InfoFileMapper.mappers.get(infoFile.version);
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
}

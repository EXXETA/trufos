import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { exists, USER_DATA_DIR } from 'main/util/fs-util';
import { Initializable } from 'main/shared/initializable';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { SemVer } from 'main/util/semver';
import { SerialQueue } from 'main/util/serial-queue';
import { z } from 'zod';
import { AppSettings } from 'shim/app-settings';

export const VERSION = new SemVer(1, 3, 0);

/** Any version of the settings file. Only the version is known before it is migrated. */
const VersionedFile = z.looseObject({ version: z.string() });
type VersionedObject = { version: string };

export const SettingsObject = z.object({
  /** The index of the currently opened collection inside the collections array */
  currentCollectionIndex: z.number().int().nonnegative(),

  /** A list of all the collection directories that have been opened */
  collections: z.array(z.string()),

  /** Application-level settings (theme, etc.). The defaults if none are stored. */
  preferences: AppSettings.prefault({}),
});
export type SettingsObject = z.infer<typeof SettingsObject>;

/** The settings file of the current version. */
const SettingsInfoFile = SettingsObject.extend({ version: z.literal(VERSION.string) });
type SettingsInfoFile = z.input<typeof SettingsInfoFile>;

interface SettingsFile_V_1_0_0 {
  currentCollectionIndex: number;
  collections: string[];
  version: '1.0.0';
}

interface SettingsFile_V_1_1_0 extends Omit<SettingsFile_V_1_0_0, 'version'> {
  /** legacy window bounds, dropped in 1.3.0 in favor of Electron's native window state persistence */
  windowState?: unknown;
  version: '1.1.0';
}

interface SettingsFile_V_1_2_0 extends Omit<SettingsFile_V_1_1_0, 'version'> {
  preferences?: z.input<typeof AppSettings>;
  version: '1.2.0';
}

type SettingsMigrator<I, O> = (old: I) => O;

const MIGRATORS = {
  '1.0.0': (old: SettingsFile_V_1_0_0): SettingsFile_V_1_1_0 => ({ ...old, version: '1.1.0' }),
  // the preferences are filled with their defaults when the settings are parsed
  '1.1.0': (old: SettingsFile_V_1_1_0): SettingsFile_V_1_2_0 => ({ ...old, version: '1.2.0' }),
  // window state is now persisted natively by Electron (windowStatePersistence), so drop the legacy field
  '1.2.0': ({ windowState: _windowState, ...rest }: SettingsFile_V_1_2_0): SettingsInfoFile => ({
    ...rest,
    version: VERSION.string,
  }),
} as const;

/**
 * A service that handles the global settings of the application. These settings are not specific to
 * a collection. For that, see {@link CollectionStateService} which has the currently opened collection.
 */
export class SettingsService implements Initializable {
  public static readonly DEFAULT_COLLECTION_DIR = path.join(USER_DATA_DIR, 'default-collection');
  public static readonly SETTINGS_FILE = path.join(USER_DATA_DIR, 'settings.json');

  public static readonly instance = new SettingsService();

  private _settings = Object.freeze(SettingsService.defaultSettings());

  /**
   * Writes the settings file one write at a time, so an earlier write cannot finish last and leave
   * older settings in the file.
   */
  private readonly writes = new SerialQueue();

  async init() {
    if (await exists(SettingsService.SETTINGS_FILE)) {
      await this.readSettings();
    } else {
      logger.info('No settings file found. Creating default.');
      await this.writeSettings();
    }
  }

  /**
   * The current settings of the application (read-only).
   */
  public get settings() {
    return this._settings;
  }

  /**
   * Sets the settings and writes them to the settings file. Resolves once the file contains these
   * settings or newer ones.
   * @param settings The new settings to set
   */
  public async setSettings(settings: Readonly<SettingsObject>): Promise<void> {
    this._settings = structuredClone(settings);
    await this.writeSettings();
  }

  /**
   * Updates the settings with the given partial settings and writes them to the settings file.
   * @param partial The partial settings to update the current settings with
   */
  public async updateSettings(partial: Partial<SettingsObject>): Promise<void> {
    await this.setSettings({ ...this._settings, ...partial });
  }

  /**
   * A copy of the current settings that can be modified.
   */
  public get modifiableSettings(): SettingsObject {
    return structuredClone(this._settings);
  }

  /**
   * Queues writing the settings file. It gets the settings as they are when the write starts. The
   * file is replaced, so a crash cannot leave it half-written.
   */
  private writeSettings(): Promise<void> {
    return this.writes.run(() => {
      const settings: SettingsInfoFile = { ...this.modifiableSettings, version: VERSION.string };
      return FileSystemService.instance.replaceFile(
        SettingsService.SETTINGS_FILE,
        JSON.stringify(settings, null, 2)
      );
    });
  }

  private async readSettings() {
    const fileContent = await readFile(SettingsService.SETTINGS_FILE, 'utf8');
    try {
      const { version: _version, ...settings } = SettingsInfoFile.parse(
        this.migrateSettings(VersionedFile.parse(JSON.parse(fileContent)))
      );
      this._settings = settings;
    } catch (error) {
      if (!(error instanceof SyntaxError) && !(error instanceof z.ZodError)) {
        throw error;
      }
      logger.warn('Settings file is empty or invalid. Recreating default settings.', error);
      this._settings = SettingsService.defaultSettings();
      await this.writeSettings();
    }
  }

  /** The settings of a new installation: only the default collection is open. */
  private static defaultSettings(): SettingsObject {
    return SettingsObject.parse({
      currentCollectionIndex: 0,
      collections: [SettingsService.DEFAULT_COLLECTION_DIR],
    });
  }

  /** Migrates the settings to the current version. The result is validated by the caller. */
  private migrateSettings(old: VersionedObject): VersionedObject {
    while (old.version !== VERSION.string) {
      const migrator = MIGRATORS[old.version as keyof typeof MIGRATORS] as SettingsMigrator<
        VersionedObject,
        SettingsInfoFile
      >;
      if (!migrator) {
        throw new Error(`No migrator found for version ${old.version}`);
      }
      old = migrator(old);
    }
    return old;
  }
}

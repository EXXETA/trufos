import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { exists, USER_DATA_DIR } from 'main/util/fs-util';
import { Initializable } from 'main/shared/initializable';
import { SemVer } from 'main/util/semver';
import { BrowserWindowConstructorOptions } from 'electron';
import { AppSettings } from 'shim/app-settings';

const DEFAULT_APP_SETTINGS: AppSettings = { theme: 'system' };

export const VERSION = new SemVer(1, 2, 0);

type VersionedObject = { version: string };

export interface SettingsObject {
  /** The index of the currently opened collection inside the collections array */
  currentCollectionIndex: number;

  /** A list of all the collection directories that have been opened */
  collections: string[];

  /** The state of the main window (size and position) */
  windowState?: Pick<BrowserWindowConstructorOptions, 'width' | 'height' | 'x' | 'y'>;

  /** Application-level UI settings (theme, etc.) */
  preferences?: AppSettings;
}

type SettingsInfoFile = SettingsObject & { version: string };

interface SettingsFile_V_1_0_0 {
  currentCollectionIndex: number;
  collections: string[];
  version: '1.0.0';
}

interface SettingsFile_V_1_1_0 {
  currentCollectionIndex: number;
  collections: string[];
  windowState?: Pick<BrowserWindowConstructorOptions, 'width' | 'height' | 'x' | 'y'>;
  version: '1.1.0';
}

type SettingsMigrator<I, O> = (old: I) => O;

const MIGRATORS = {
  '1.0.0': (old: SettingsFile_V_1_0_0): SettingsFile_V_1_1_0 => ({ ...old, version: '1.1.0' }),
  '1.1.0': (old: SettingsFile_V_1_1_0): SettingsInfoFile => ({
    ...old,
    preferences: DEFAULT_APP_SETTINGS,
    version: VERSION.string,
  }),
} as const;

/**
 * A service that handles the global settings of the application. These settings are not specific to
 * a collection. For that, see {@link EnvironmentService} which has the currently opened collection.
 */
export class SettingsService implements Initializable {
  public static readonly DEFAULT_COLLECTION_DIR = path.join(USER_DATA_DIR, 'default-collection');
  public static readonly SETTINGS_FILE = path.join(USER_DATA_DIR, 'settings.json');

  public static readonly instance = new SettingsService();

  private _settings = Object.freeze<SettingsObject>({
    currentCollectionIndex: 0,
    collections: [SettingsService.DEFAULT_COLLECTION_DIR],
  });

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
   * Sets the settings and writes them to the settings file.
   * @param settings The new settings to set
   */
  public async setSettings(settings: Readonly<SettingsObject>) {
    this._settings = structuredClone(settings);
    await this.writeSettings();
  }

  /**
   * Updates the settings with the given partial settings and writes them to the settings file.
   * @param partial The partial settings to update the current settings with
   */
  public async updateSettings(partial: Partial<SettingsObject>) {
    await this.setSettings({ ...this._settings, ...partial });
  }

  /**
   * A copy of the current settings that can be modified.
   */
  public get modifiableSettings(): SettingsObject {
    return structuredClone(this._settings);
  }

  private async writeSettings() {
    const settings: SettingsObject & { version?: string } = this.modifiableSettings;
    settings.version = VERSION.string;
    await writeFile(SettingsService.SETTINGS_FILE, JSON.stringify(settings, null, 2));
  }

  private async readSettings() {
    const fileContent = await readFile(SettingsService.SETTINGS_FILE, 'utf8');
    try {
      this._settings = this.migrateSettings(JSON.parse(fileContent));
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error;
      }
      logger.warn('Settings file is empty or invalid. Recreating default settings.', error);
      this._settings = {
        currentCollectionIndex: 0,
        collections: [SettingsService.DEFAULT_COLLECTION_DIR],
      };
      await this.writeSettings();
    }
  }

  private migrateSettings(old: VersionedObject): SettingsInfoFile {
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
    return old as SettingsInfoFile;
  }
}

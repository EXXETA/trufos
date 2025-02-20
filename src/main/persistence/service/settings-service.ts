import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { exists, USER_DATA_DIR } from 'main/util/fs-util';
import { Initializable } from 'main/shared/initializable';

export type SettingsObject = {
  /** The index of the currently opened collection inside the collections array */
  currentCollectionIndex: number;

  /** A list of all the collection directories that have been opened */
  collections: string[];
};

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
      console.info('No settings file found. Creating default.');
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
   * A copy of the current settings that can be modified.
   */
  public get modifiableSettings(): SettingsObject {
    return structuredClone(this._settings);
  }

  private async writeSettings() {
    await writeFile(SettingsService.SETTINGS_FILE, JSON.stringify(this._settings, null, 2));
  }

  private async readSettings() {
    this._settings = JSON.parse(await readFile(SettingsService.SETTINGS_FILE, 'utf8'));
  }
}

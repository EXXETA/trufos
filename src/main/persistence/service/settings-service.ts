import path from 'node:path';
import { EventEmitter } from 'node:events';
import { USER_DATA_DIR } from 'main/util/fs-util';
import { SemVer } from 'main/util/semver';
import { JsonFile, JsonFileMigrator } from 'main/persistence/json-file';
import { Initializable } from 'main/shared/initializable';
import type { Immutable } from 'immer';
import { z } from 'zod';
import { AppSettings } from 'shim/app-settings';

export const VERSION = new SemVer(2, 0, 0);

/** The part of a settings file before 2.0.0 that is kept. The preferences exist since 1.2.0. */
const LegacySettingsFile = z.looseObject({ preferences: z.looseObject({}).optional() });

/**
 * Keeps the preferences of a settings file before 2.0.0, which are validated with the current
 * schema afterwards. The open collections it also had are deliberately dropped instead of moved
 * to the app state (`state.json`): the project is in alpha, and losing the list of open
 * collections once is cheaper than migrating data between files.
 */
const fromLegacy: JsonFileMigrator = (old) => ({
  ...LegacySettingsFile.parse(old).preferences,
  version: VERSION.string,
});

const MIGRATORS = {
  '1.0.0': fromLegacy,
  '1.1.0': fromLegacy,
  '1.2.0': fromLegacy,
  '1.3.0': fromLegacy,
};

/** Event signatures emitted by the {@link SettingsService}. */
type SettingsServiceEvents = {
  /** The settings were replaced. */
  changed: [];
};

/**
 * Keeps the settings of the application, i.e. the preferences of the user, in `settings.json`. The
 * state of the application, e.g. which collections are open, is kept by the {@link StateService}.
 */
export class SettingsService extends EventEmitter<SettingsServiceEvents> implements Initializable {
  public static readonly SETTINGS_FILE = path.join(USER_DATA_DIR, 'settings.json');

  public static readonly instance = new SettingsService();

  private readonly file = new JsonFile<AppSettings>({
    filePath: SettingsService.SETTINGS_FILE,
    version: VERSION,
    schema: AppSettings,
    migrators: MIGRATORS,
  });

  public init(): Promise<void> {
    return this.file.init();
  }

  /** The current settings. */
  public get settings(): Immutable<AppSettings> {
    return this.file.value;
  }

  /** Replaces the settings and stores them. */
  public async setSettings(settings: AppSettings): Promise<void> {
    await this.file.set(settings);
    this.emit('changed');
  }
}

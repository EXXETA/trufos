import { describe, expect, it } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { SettingsService, VERSION } from './settings-service';
import { DEFAULT_APP_SETTINGS, TrufosTheme } from 'shim/app-settings';

const settingsService = SettingsService.instance;

const readSettingsFile = async (): Promise<unknown> =>
  JSON.parse(await readFile(SettingsService.SETTINGS_FILE, 'utf8'));

describe('SettingsService', () => {
  it('creates the settings file with the default settings', async () => {
    await settingsService.init();

    expect(settingsService.settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(await readSettingsFile()).toEqual({ ...DEFAULT_APP_SETTINGS, version: VERSION.string });
  });

  it('stores the settings', async () => {
    await settingsService.init();

    await settingsService.setSettings({ theme: TrufosTheme.Dark, verifyTlsCertificates: false });

    expect(await readSettingsFile()).toEqual({
      theme: TrufosTheme.Dark,
      verifyTlsCertificates: false,
      version: VERSION.string,
    });
  });

  it.each(['1.2.0', '1.3.0'])(
    'keeps the preferences of a %s settings file and drops the open collections',
    async (version) => {
      await writeFile(
        SettingsService.SETTINGS_FILE,
        JSON.stringify({
          version,
          currentCollectionIndex: 1,
          collections: ['/a', '/b'],
          windowState: { width: 1280, height: 800 },
          preferences: { theme: 'dark' },
        })
      );

      await settingsService.init();

      // the open collections are deliberately dropped, not moved to the app state, see fromLegacy
      expect(settingsService.settings).toEqual({ theme: 'dark', verifyTlsCertificates: true });
    }
  );

  it.each(['1.0.0', '1.1.0'])(
    'uses the default settings for a %s settings file',
    async (version) => {
      await writeFile(
        SettingsService.SETTINGS_FILE,
        JSON.stringify({ version, currentCollectionIndex: 0, collections: ['/a'] })
      );

      await settingsService.init();

      expect(settingsService.settings).toEqual(DEFAULT_APP_SETTINGS);
    }
  );
});

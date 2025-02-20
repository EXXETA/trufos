import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { SettingsService } from './settings-service';
import { exists } from 'main/util/fs-util';

const settingsService = SettingsService.instance;

describe('SettingsService', async () => {
  it('should create a new settings if none exists', async () => {
    // Assert
    expect(await exists(SettingsService.SETTINGS_FILE)).toBe(false);

    // Act
    await settingsService.init();

    // Assert
    expect(await exists(SettingsService.SETTINGS_FILE)).toBe(true);
    expect(settingsService.settings.currentCollectionIndex).toBe(0);
  });

  it('should provide a deep clone of settings at modifiedSettings', () => {
    // Act
    const { modifiableSettings } = settingsService;

    // Assert
    expect(modifiableSettings).not.toBe(settingsService.settings);
    expect(modifiableSettings).toEqual(settingsService.settings);
  });

  it('should persist settings when set', async () => {
    // Arrange
    await settingsService.init();
    const newSettings: import('./settings-service').SettingsObject = {
      currentCollectionIndex: 1,
      collections: ['path/to/collection', 'some/where/else'],
    };

    // Assert
    expect(settingsService.settings).not.toEqual(newSettings);
    expect(JSON.parse(await readFile(SettingsService.SETTINGS_FILE, 'utf8'))).toEqual(
      settingsService.settings
    );

    // Act
    await settingsService.setSettings(newSettings);

    // Assert
    expect(settingsService.settings).toEqual(newSettings);
    expect(JSON.parse(await readFile(SettingsService.SETTINGS_FILE, 'utf8'))).toEqual(newSettings);
  });
});

import { describe, expect, it } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { SettingsService, VERSION } from './settings-service';
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
    expect(JSON.parse(await readFile(SettingsService.SETTINGS_FILE, 'utf8'))).toMatchObject(
      settingsService.settings
    );

    // Act
    await settingsService.setSettings(newSettings);

    // Assert
    expect(settingsService.settings).toEqual(newSettings);
    expect(JSON.parse(await readFile(SettingsService.SETTINGS_FILE, 'utf8'))).toMatchObject(
      newSettings
    );
  });

  it('should update partial settings and persist to file', async () => {
    // Arrange
    await settingsService.init();
    const originalCollections = settingsService.settings.collections;

    // Act
    await settingsService.updateSettings({ currentCollectionIndex: 2 });

    // Assert
    expect(settingsService.settings.currentCollectionIndex).toBe(2);
    expect(settingsService.settings.collections).toEqual(originalCollections);
    expect(JSON.parse(await readFile(SettingsService.SETTINGS_FILE, 'utf8'))).toMatchObject({
      currentCollectionIndex: 2,
      collections: originalCollections,
    });
  });

  it('should migrate settings from 1.0.0 to 1.1.0 on init', async () => {
    // Arrange
    const oldSettings = {
      version: '1.0.0',
      currentCollectionIndex: 1,
      collections: ['path/to/collection1', 'path/to/collection2'],
    };
    await writeFile(SettingsService.SETTINGS_FILE, JSON.stringify(oldSettings));

    // Act
    await settingsService.init();

    // Assert - migrated in memory
    expect(settingsService.settings.currentCollectionIndex).toBe(1);
    expect(settingsService.settings.collections).toEqual([
      'path/to/collection1',
      'path/to/collection2',
    ]);

    // Act - persist migrated settings
    await settingsService.updateSettings({});

    // Assert - file now has migrated version
    const fileContent = JSON.parse(await readFile(SettingsService.SETTINGS_FILE, 'utf8'));
    expect(fileContent.version).toBe('1.1.0');
    expect(fileContent.currentCollectionIndex).toBe(1);
    expect(fileContent.collections).toEqual(['path/to/collection1', 'path/to/collection2']);
  });

  it('should throw error when migrating from unknown version', async () => {
    // Arrange
    await settingsService.init();
    const unknownVersionSettings = {
      version: '0.0.0',
      currentCollectionIndex: 0,
      collections: [SettingsService.DEFAULT_COLLECTION_DIR],
    };

    // Act & Assert
    await writeFile(SettingsService.SETTINGS_FILE, JSON.stringify(unknownVersionSettings));
    await expect(settingsService.init()).rejects.toThrow('No migrator found for version 0.0.0');
  });

  it('should handle settings already at current version', async () => {
    // Arrange
    await settingsService.init();
    const currentSettings = {
      version: VERSION.string,
      currentCollectionIndex: 0,
      collections: [SettingsService.DEFAULT_COLLECTION_DIR],
    };
    await writeFile(SettingsService.SETTINGS_FILE, JSON.stringify(currentSettings));

    // Act - should not throw
    await settingsService.init();

    // Assert
    expect(settingsService.settings.currentCollectionIndex).toBe(0);
    expect(settingsService.settings.collections).toEqual([SettingsService.DEFAULT_COLLECTION_DIR]);
  });
});

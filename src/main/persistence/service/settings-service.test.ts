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

  it.each([
    {
      version: '1.0.0',
      oldSettings: {
        currentCollectionIndex: 1,
        collections: ['path/to/collection1', 'path/to/collection2'],
      },
      expected: {
        currentCollectionIndex: 1,
        collections: ['path/to/collection1', 'path/to/collection2'],
        preferences: { theme: 'system' },
      },
    },
    {
      version: '1.1.0',
      oldSettings: {
        currentCollectionIndex: 0,
        collections: [SettingsService.DEFAULT_COLLECTION_DIR],
        windowState: { width: 1280, height: 800 },
      },
      expected: {
        currentCollectionIndex: 0,
        collections: [SettingsService.DEFAULT_COLLECTION_DIR],
        preferences: { theme: 'system' },
      },
    },
    {
      version: '1.2.0',
      oldSettings: {
        currentCollectionIndex: 1,
        collections: ['path/to/collection1', 'path/to/collection2'],
        windowState: { width: 1280, height: 800, x: 10, y: 20 },
        preferences: { theme: 'dark' },
      },
      expected: {
        currentCollectionIndex: 1,
        collections: ['path/to/collection1', 'path/to/collection2'],
        preferences: { theme: 'dark' },
      },
    },
  ])(
    'should migrate settings from $version to current version on init',
    async ({ version, oldSettings, expected }) => {
      // Arrange
      await writeFile(SettingsService.SETTINGS_FILE, JSON.stringify({ version, ...oldSettings }));

      // Act
      await settingsService.init();

      // Assert - migrated in memory, legacy window state dropped
      expect(settingsService.settings).toMatchObject(expected);
      expect(settingsService.settings).not.toHaveProperty('windowState');

      // Act - persist migrated settings
      await settingsService.updateSettings({});

      // Assert - file now has migrated version
      const fileContent = JSON.parse(await readFile(SettingsService.SETTINGS_FILE, 'utf8'));
      expect(fileContent).toMatchObject({ ...expected, version: VERSION.string });
      expect(fileContent).not.toHaveProperty('windowState');
    }
  );

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

  it('should recreate default settings when file is empty', async () => {
    // Arrange
    await writeFile(SettingsService.SETTINGS_FILE, '');

    // Act
    await settingsService.init();

    // Assert
    expect(settingsService.settings).toEqual({
      currentCollectionIndex: 0,
      collections: [SettingsService.DEFAULT_COLLECTION_DIR],
    });
    expect(JSON.parse(await readFile(SettingsService.SETTINGS_FILE, 'utf8'))).toMatchObject(
      settingsService.settings
    );
  });

  it('should recreate default settings when file contains invalid JSON', async () => {
    // Arrange
    await writeFile(SettingsService.SETTINGS_FILE, '{');

    // Act
    await settingsService.init();

    // Assert
    expect(settingsService.settings).toEqual({
      currentCollectionIndex: 0,
      collections: [SettingsService.DEFAULT_COLLECTION_DIR],
    });
    expect(JSON.parse(await readFile(SettingsService.SETTINGS_FILE, 'utf8'))).toMatchObject(
      settingsService.settings
    );
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

---
title: Settings Service
nav_order: 5
parent: Core Services
---

# Settings Service

**Location**: `src/main/persistence/service/settings-service.ts`

The `SettingsService` is a main process service responsible for managing global application settings. These settings are not specific to any single collection but rather pertain to the overall state and configuration of the Trufos application itself.

## Responsibilities

*   **Loading and Saving Settings**:
    *   Manages application settings stored in a JSON file: `settings.json`.
    *   The location of this file is within the application's user data directory (e.g., `app.getPath('userData')/settings.json`).
*   **Providing Access to Settings**:
    *   Offers read-only access to the current settings.
    *   Provides a mechanism to update settings and persist them.
*   **Initialization**:
    *   On application startup (`init()` method, called by `src/main/main.ts`), it checks if `settings.json` exists.
    *   If the file exists, it reads and loads the settings.
    *   If the file does not exist, it creates a default `settings.json` file with initial values.

## Settings Data Structure

The settings are defined by the `SettingsObject` type:

```typescript
export type SettingsObject = {
  /** The index of the currently opened collection inside the collections array */
  currentCollectionIndex: number;

  /** A list of all the collection directories that have been opened */
  collections: string[];
};
```

When persisted to `settings.json`, a `version` field (currently `1.0.0` based on `SemVer`) is added to the `SettingsInfoFile` type to allow for future schema migrations if needed, although no migration logic for settings is currently implemented.

```typescript
type SettingsInfoFile = SettingsObject & { version: typeof VERSION.string };
```

## Key Properties and Methods

*   **`DEFAULT_COLLECTION_DIR` (static readonly)**:
    *   Defines the path to the default collection directory, typically `USER_DATA_DIR/default-collection`.
*   **`SETTINGS_FILE` (static readonly)**:
    *   Defines the full path to the `settings.json` file.
*   **`instance` (static readonly)**:
    *   Provides a singleton instance of the `SettingsService`.
*   **`init(): Promise<void>`**:
    *   Asynchronous initialization method. Reads existing settings or writes default ones. Implements the `Initializable` interface.
*   **`settings` (getter): `Readonly<SettingsObject>`**:
    *   Returns a read-only version of the current settings. This prevents accidental modification of the in-memory settings without going through the designated update mechanism.
*   **`setSettings(settings: Readonly<SettingsObject>): Promise<void>`**:
    *   Updates the in-memory settings with a deep clone of the provided `settings` object.
    *   Persists the new settings (including the schema version) to `settings.json`.
*   **`modifiableSettings` (getter): `SettingsObject`**:
    *   Returns a deep clone of the current settings. This allows other services or parts of the application to safely modify a copy of the settings before deciding to persist them using `setSettings`.

## Interaction with Other Services

*   **`EnvironmentService`**:
    *   Reads `settings.collections` and `settings.currentCollectionIndex` from `SettingsService` to determine which collection to load on startup or when listing available collections.
    *   Updates `SettingsService` (via `setSettings`) when the user changes the active collection or closes a collection, modifying the `collections` array and `currentCollectionIndex`.
*   **`PersistenceService`**:
    *   Uses `SettingsService.DEFAULT_COLLECTION_DIR` to know where to create the default collection if it's missing.

The `SettingsService` ensures that user preferences regarding which collections are open and which one is active are remembered across application sessions. 
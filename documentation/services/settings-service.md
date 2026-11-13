---
title: Settings and State
nav_order: 5
parent: Services
description: SettingsService and StateService, which keep the user's preferences and the state of the app in the user data directory.
---

# Settings and State

**Location**: `src/main/persistence/service/settings-service.ts`, `state-service.ts`

The app keeps two JSON files in the user data directory, split by who decides their content:

- `settings.json` (`SettingsService`): the **preferences** the user chooses in the app settings.
- `state.json` (`StateService`): the **state** of the app the user does not edit directly: which collections are open, which is current, and what each one looked like.

Both services hold a `JsonFile` privately and offer the operations on its content. Both are initialised in `main.ts` before the collection is loaded.

## `JsonFile`

**Location**: `src/main/persistence/json-file.ts`

A JSON file of the app that is kept in memory:

- **Versioned**: the file has a `version`. Migrators registered by version upgrade older files step by step when they are read.
- **Validated**: the content is parsed with a Zod schema whenever it is read or changed, so the schema's defaults and transforms apply to every change. The schema has to accept `{}`, which is the content of a new file.
- **Immutable**: the content in memory is deeply frozen. `update(recipe)` changes it with an Immer recipe; `set(value)` replaces it.
- **Safe to write**: reads and writes run one at a time on a `SerialQueue`, and the file is replaced atomically.

`PluginService` uses the same class for `plugins.json`.

## `SettingsService`

The settings are `AppSettings` from `src/shim/app-settings.ts`:

```ts
const AppSettings = z.object({
  theme: ThemePreference.default('system'),           // 'light' | 'dark' | 'system'
  verifyTlsCertificates: z.boolean().default(true),
  mcpServer: McpServerSettings.prefault({}),          // enabled, port, permissions
});
```

- `settings` returns the current settings; `setSettings(settings)` replaces and stores them and emits `changed`. The `McpServerService` listens to `changed` to start, stop or restart the server.
- The renderer reads them with `getAppSettings()` and writes them with `saveAppSettings()`, which parses them with `AppSettings` first. In the renderer they live in `useAppSettingsStore`.
- Settings files before version 2.0.0 also held the open collections. Their migrator keeps only the preferences; the list of open collections was deliberately dropped instead of moved to `state.json`.

To add a setting, add the field with a default to `AppSettings`. Files without it get the default, so no migrator is needed.

## `StateService`

The content of `state.json`:

- `collections`: the open collections, each with its `dirPath`, the key of the environment selected last (`null` for none) and the UI state the renderer stored (`CollectionUiState`: selected request, open folders, sort mode, script tab).
- `currentCollection`: the directory of the current collection.

The schema enforces two rules after every change: the default collection is always open, and the current collection is one of the open ones (otherwise the default collection becomes current).

| Member | Purpose |
| --- | --- |
| `DEFAULT_COLLECTION_DIR` | `<userData>/default-collection` |
| `openCollections`, `currentCollection` | The open collections and the current one |
| `open(dirPath)` | Opens a collection, if it is not open yet, and makes it current |
| `close(dirPath)` | Closes a collection and forgets its state |
| `selectedEnvironment(dirPath, environments)` | The environment to select when a collection is loaded: the stored one if it still exists, none if none was selected, the first otherwise |
| `selectEnvironment(dirPath, key)` | Stores the selected environment |
| `uiState(dirPath)`, `saveUiState(dirPath, uiState)` | The stored UI state of a collection |

Nothing is stored for a collection that is not open. The `CollectionStateService` calls these methods when collections are opened, created or closed and when a command changes the selected environment; the renderer stores the UI state through `saveCollectionUiState()`.

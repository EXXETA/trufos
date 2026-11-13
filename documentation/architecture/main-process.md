---
title: Main Process
nav_order: 1
parent: Architecture
description: How the main process starts, which services it runs and how it handles closing the window.
---

# Main Process

The main process is the Node.js side of Electron. In Trufos it owns the open collection, reads and writes all files, sends HTTP requests, runs scripts and plugins, and serves the optional MCP server. The renderer reaches all of this through [IPC]({% link documentation/architecture/ipc-communication.md %}).

## Startup

The entry point is `src/main/main.ts`:

1. Importing `./logging/logger` first sets up the global Winston `logger`, see [Logging]({% link documentation/architecture/logging.md %}).
2. On Windows, Squirrel install and uninstall events quit the app right away (`electron-squirrel-startup`).
3. Uncaught exceptions and unhandled rejections show an error dialog and quit.
4. Once Electron is ready, `createWindow()` checks that `safeStorage` encryption is available (secrets cannot be stored otherwise) and initialises the services in this order:
   1. `SettingsService`: the user's preferences in `settings.json`.
   2. `PluginService`: reads the manifests of the bundled plugins.
   3. `StateService`: the open collections and their UI state in `state.json`.
   4. `CollectionStateService`: loads the current collection.
   5. `McpServerService`: starts the MCP server if it is enabled. A server that cannot start is reported in the settings; the app starts anyway.
5. `update-electron-app` checks for updates every hour. It only updates on Windows, see [Building and Packaging]({% link documentation/development/building-packaging.md %}#releases).
6. The `BrowserWindow` is created hidden, with `src/main/preload.ts` as its preload script, and the native menu is built (`MenuBuilder`, `src/main/menu.ts`). The window is shown once the renderer sends `renderer-ready`, after it applied the saved theme, so it never flashes the wrong colours.
7. Links the renderer opens go to the default browser.
8. The renderer is loaded from the Vite dev server in development, or from the bundled `index.html`.

## Services

The main-process services are singletons with a static `instance`. Those that read files at startup implement `Initializable` (`init()`).

| Service | Location | Responsibility |
| --- | --- | --- |
| `CollectionStateService` | `collection-state/` | Owns the open collection as a model, applies commands, persists and broadcasts changes, watches the files. See [Main-Owned Collection State]({% link documentation/architecture/collection-state.md %}). |
| `PersistenceService` | `persistence/service/` | Reads and writes collections, folders, requests, bodies and scripts. See [Persistence Service]({% link documentation/services/persistence-service.md %}). |
| `SecretService` | `persistence/service/` | Encrypts secrets with Electron's `safeStorage`. |
| `SettingsService`, `StateService` | `persistence/service/` | `settings.json` and `state.json`. See [Settings and State]({% link documentation/services/settings-service.md %}). |
| Variable resolver | `environment/service/` | Resolves variables and authorization from a model. See [Variable Resolver]({% link documentation/services/variable-resolver.md %}). |
| `HttpService` | `network/service/` | Sends requests with undici, runs scripts around them, records them in the history. See [HTTP Service]({% link documentation/services/http-service.md %}). |
| `BodyStore` | `network/service/` | Keeps request and response bodies of the session in encrypted temporary files. |
| `ScriptingService` | `scripting/` | Runs pre-request and post-response scripts in a `node:vm` context with the `trufos` API and a 5-second timeout. |
| `HistoryService` | `history/` | The request history of the session, per collection. It is kept in memory and never written to disk. |
| `ImportService`, `ExportService` | `import/`, `export/` | Import through plugin importers; export as ZIP or through plugin exporters. |
| `PluginService` | `plugin/` | Discovers plugins, builds their contribution index and activates them on first use. See [Plugin Architecture]({% link documentation/architecture/plugins.md %}). |
| `McpServerService` | `mcp/` | The MCP server on `127.0.0.1`. See [MCP Server]({% link documentation/architecture/mcp-server.md %}). |
| `FileSystemService` | `filesystem/` | Temporary files and atomic writes (`replaceFile()`). |
| `MainEventService` | `event/` | Registers an IPC handler for every method of `IEventService` and pushes events to the renderer. See [Event Service]({% link documentation/services/event-service.md %}). |

## Closing the window

Closing the window does not quit at once. Main cancels the first `close` event and sends `before-close` to the renderer, which sends its pending editor changes and UI state and answers `ready-to-close`. Main then writes every pending change of the collection (`closeAfterFlush()` in `close-window.ts`) and quits. If the renderer does not answer within 30 seconds, main writes what it has and quits anyway.

On `will-quit`, the MCP server stops, the `BodyStore` closes its files and `FileSystemService` deletes the temporary files of the session.

## Build

Main and preload are bundled by Vite, configured in `src/main/vite.config.mts`. Bundled plugins are dynamic imports, so Vite puts each into its own chunk that is only loaded when the plugin is first used. See [Building and Packaging]({% link documentation/development/building-packaging.md %}).

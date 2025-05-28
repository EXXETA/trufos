---
title: Main Process
nav_order: 1
parent: Architecture Overview
---

# Main Process

The Main process in an Electron application is the entry point and the core of the application. It runs a full Node.js environment and is responsible for managing the application's lifecycle, displaying native UI elements (like menus, dialogs), and creating and managing renderer processes (web pages).

## Entry Point

The entry point for Trufos's main process is `src/main/main.ts`. This file:
1.  Initializes global logging using Winston (`src/main/logging/logger.ts`).
2.  Handles Electron Forge's squirrel startup events for Windows installations.
3.  Initializes core services in the correct order:
    *   `SettingsService` (`src/main/persistence/service/settings-service.ts`): Manages application-wide settings.
    *   `EnvironmentService` (`src/main/environment/service/environment-service.ts`): Manages the current collection, environments, and variables.
4.  Defines the `createWindow` function, which:
    *   Creates the main `BrowserWindow`.
    *   Configures web preferences, including the `preload` script (`src/main/preload.ts`).
    *   Sets up a window open handler to open external links in the default browser.
    *   Handles the window `close` event gracefully, allowing the renderer process to perform cleanup before quitting (see [IPC Communication]({% link documentation/architecture/ipc-communication.md %})).
    *   Loads the renderer's HTML file (`index.html`), either from the Vite dev server (in development) or from the packaged application.
5.  Manages Electron app lifecycle events (`ready`, `window-all-closed`, `activate`).

## Core Services

The main process hosts several key services crucial for Trufos's functionality:

*   **`EnvironmentService` (`src/main/environment/service/environment-service.ts`)**:
    *   Manages the currently active collection and its associated environments and variables (system, collection, environment-specific).
    *   Provides methods to get and set variables, change collections, and list available collections.
    *   Uses `template-replace-stream` to substitute variables in request bodies.
    *   See [Environment Service]({% link documentation/services/environment-service.md %}) for more details.

*   **`PersistenceService` (`src/main/persistence/service/persistence-service.ts`)**:
    *   Handles all file system operations for storing and retrieving collections, folders, and requests.
    *   Manages the on-disk structure of collections (JSON info files, text body files).
    *   Implements logic for creating, saving, loading, renaming, and deleting Trufos objects.
    *   Handles schema migration for info files (`src/main/persistence/service/info-files/`).
    *   See [Persistence Service]({% link documentation/services/persistence-service.md %}) for more details.

*   **`SettingsService` (`src/main/persistence/service/settings-service.ts`)**:
    *   Manages global application settings stored in `settings.json` (e.g., list of opened collections, current collection index).
    *   See [Settings Service]({% link documentation/services/settings-service.md %}) for more details.

*   **`HttpService` (`src/main/network/service/http-service.ts`)**:
    *   Responsible for making actual HTTP requests using `undici`.
    *   Handles request body streaming, header processing, and response body saving to temporary files.
    *   Calculates response metadata like duration and size.
    *   See [HTTP Service]({% link documentation/services/http-service.md %}) for more details.

*   **`MainEventService` (`src/main/event/main-event-service.ts`)**:
    *   Sets up IPC (Inter-Process Communication) handlers for requests coming from the renderer process.
    *   Acts as a bridge between the renderer and other main process services.
    *   See [IPC Communication]({% link documentation/architecture/ipc-communication.md %}) and [Event Service]({% link documentation/services/event-service.md %}) for more details.

*   **`ImportService` (`src/main/import/service/import-service.ts`)**:
    *   Handles importing collections from other formats (e.g., Postman via `PostmanImporter`).

*   **`FileSystemService` (`src/main/filesystem/filesystem-service.ts`)**:
    *   Provides utility functions for common file system operations, such as creating temporary files.

*   **Logging (`src/main/logging/logger.ts`)**:
    *   Configures a global Winston logger for the main process.
    *   Logs to files and, in development, to the console.
    *   Receives log entries from the renderer process via IPC.
    *   See [Logging]({% link documentation/architecture/logging.md %}) for more details.

## Preload Script

The `src/main/preload.ts` script is crucial for secure IPC. It runs in a special context with access to both the Node.js environment of the main process and the `window` object of the renderer process. It selectively exposes an API (via `contextBridge`) that the renderer process can use to communicate with the main process.

## Build Configuration

The main process code is built using Vite, as configured in `src/main/vite.config.ts`. This configuration primarily sets up aliases for easier imports and configures Vitest for testing. 
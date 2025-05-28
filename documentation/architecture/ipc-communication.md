---
title: IPC Communication
nav_order: 3
parent: Architecture Overview
---

# IPC Communication (Inter-Process Communication)

Electron applications consist of a main process and one or more renderer processes. These processes run in isolation and cannot directly access each other's memory. Inter-Process Communication (IPC) is the mechanism that allows them to communicate.

Trufos uses Electron's IPC modules (`ipcMain` and `ipcRenderer`) along with a preload script for secure and structured communication.

## Preload Script

*   **File**: `src/main/preload.ts`
*   **Purpose**: The preload script runs in a privileged context that has access to both the renderer's `window` object and Node.js APIs. It acts as a bridge, selectively exposing main process functionalities to the renderer process in a secure way using `contextBridge.exposeInMainWorld`.
*   **Implementation**:
    ```typescript
    // src/main/preload.ts
    import { contextBridge, ipcRenderer } from 'electron';

    const electronHandler = {
      ipcRenderer: {
        send: ipcRenderer.send.bind(ipcRenderer),
        // ... other ipcRenderer methods like on, once, invoke, removeListener
      },
    };

    contextBridge.exposeInMainWorld('electron', electronHandler);

    export type ElectronHandler = typeof electronHandler;
    ```
    This exposes an `electron` object on the global `window` in the renderer process (`window.electron`).
*   **Type Definitions**: `src/renderer/preload.d.ts` provides TypeScript definitions for `window.electron` for type safety in the renderer code.

## Communication Flow: Renderer to Main (Request/Response)

For most operations initiated by the UI (renderer) that require main process capabilities (e.g., file system access, network requests), a request/response pattern using `ipcRenderer.invoke` and `ipcMain.handle` is used.

1.  **Renderer (`RendererEventService`)**:
    *   `src/renderer/services/event/renderer-event-service.ts`
    *   Provides an abstraction layer for sending requests to the main process.
    *   Uses a helper `createEventMethod` which wraps `window.electron.ipcRenderer.invoke(channel, ...args)`.
    *   This `invoke` call sends a message to the specified `channel` and returns a Promise that resolves with the main process's response.
    *   If the main process returns an `Error` object, `RendererEventService` throws it as a `MainProcessError`.

2.  **Main (`MainEventService`)**:
    *   `src/main/event/main-event-service.ts`
    *   Initializes itself by iterating over its methods and registering handlers for each using `ipcMain.handle(channel, handler)`. The `channel` name is derived from the method name.
    *   The `handler` function is an async function that typically calls another service in the main process (e.g., `PersistenceService`, `HttpService`).
    *   A `wrapWithErrorHandler` utility ensures that any exceptions thrown by the actual service methods are caught and returned as `Error` objects to the renderer, which `RendererEventService` then re-throws.

**Example**: Fetching app version
*   Renderer (`RendererEventService.getAppVersion()`):
    ```typescript
    // Simplified
    async getAppVersion() {
      const result = await window.electron.ipcRenderer.invoke('getAppVersion');
      if (result instanceof Error) throw new MainProcessError(result.message);
      return result;
    }
    ```
*   Main (`MainEventService.getAppVersion()`):
    ```typescript
    // Simplified, registered via ipcMain.handle('getAppVersion', ...)
    async getAppVersion() {
      return app.getVersion(); // electron.app
    }
    ```

## Communication Flow: Main to Renderer (Events)

For events initiated by the main process or for continuous data streams, `webContents.send` (main) and `ipcRenderer.on` (renderer) are used.

*   **Main Process**:
    *   Can send messages to a specific renderer process (window) using `mainWindow.webContents.send(channel, ...args)`.
    *   Example: In `src/main/main.ts`, before closing the window: `mainWindow?.webContents.send('before-close');`

*   **Renderer Process (`RendererEventService`)**:
    *   Listens for these messages using `window.electron.ipcRenderer.on(channel, listener)`.
    *   Example: The `RendererEventService` itself can act as an event emitter or forward these events.
        ```typescript
        // In RendererEventService
        on(event: 'before-close', listener: () => void) {
          window.electron.ipcRenderer.on(event, listener);
          return this;
        }
        ```
        The `collectionStore.ts` listens for the `'before-close'` event to save any pending request changes.

## Streaming Data (IPC Push Stream)

For streaming large data, like request/response bodies, Trufos uses a custom IPC stream implementation.

*   **Main Process (`src/main/event/stream-events.ts`)**:
    *   Handles `'stream-open'` IPC call: Creates a `fs.ReadStream` for a file or from `PersistenceService.loadTextBodyOfRequest`.
    *   Assigns a unique ID to the stream.
    *   Listens to `data`, `end`, and `error` events on the Node.js stream and sends corresponding IPC messages (`'stream-data'`, `'stream-end'`, `'stream-error'`) to the renderer, tagged with the stream ID.
    *   Handles `'stream-close'` IPC call to close the server-side stream.

*   **Renderer Process (`src/renderer/lib/ipc-stream.ts`)**:
    *   `IpcPushStream` class:
        *   `open(filePathOrRequest)`: Sends `'stream-open'` to main and gets a stream ID.
        *   Listens for `'stream-data'`, `'stream-end'`, `'stream-error'` IPC messages from main, filtered by stream ID, and emits corresponding events on the `IpcPushStream` instance.
        *   `close()`: Sends `'stream-close'` to main.
        *   `collect(stream)`: Utility to aggregate all data from a stream into a single string.

This setup allows efficient streaming of potentially large data from main to renderer without overwhelming the IPC channel with single large messages.

## Channels Used

The primary channels are implicitly defined by the method names in `IEventService` (`src/shim/event-service.ts`) and used by `MainEventService` and `RendererEventService`.
Additional channels for streaming:
*   `stream-open` (renderer to main, invoke)
*   `stream-close` (renderer to main, on)
*   `stream-data` (main to renderer)
*   `stream-end` (main to renderer)
*   `stream-error` (main to renderer)
Logging channel:
*   `log` (renderer to main, for forwarding renderer logs)
Application lifecycle:
*   `before-close` (main to renderer)
*   `ready-to-close` (renderer to main) 
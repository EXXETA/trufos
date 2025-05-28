---
title: Event Service (IPC)
nav_order: 2
parent: Core Services
---

# Event Service (IPC)

The Event Service in Trufos facilitates Inter-Process Communication (IPC) between the main process and the renderer process. It's implemented as two distinct but related services: `MainEventService` for the backend and `RendererEventService` for the frontend.

## `MainEventService`

*   **Location**: `src/main/event/main-event-service.ts`
*   **Purpose**: To expose main process functionalities to the renderer process securely and handle requests originating from the UI.
*   **Mechanism**:
    *   It implements the `IEventService` interface (defined in `src/shim/event-service.ts`).
    *   During its construction, it iterates over its own methods and dynamically registers IPC handlers for each using `ipcMain.handle(channelName, handler)`. The `channelName` is typically the method name itself.
    *   Each handler is wrapped with `wrapWithErrorHandler`, which catches errors from the underlying service calls, logs them, and returns them as standard `Error` objects over IPC.
*   **Responsibilities**:
    *   Delegates calls to other main process services (e.g., `PersistenceService`, `HttpService`, `EnvironmentService`).
    *   Acts as the single point of entry for most renderer-to-main communication.
    *   Handles specialized IPC events like those for [data streaming](./ipc-communication.md#streaming-data-ipc-push-stream) (`stream-events.ts`) and log forwarding.

## `RendererEventService`

*   **Location**: `src/renderer/services/event/renderer-event-service.ts`
*   **Purpose**: To provide a clean, Promise-based API for renderer-side code to interact with the main process functionalities exposed by `MainEventService`.
*   **Mechanism**:
    *   It also conceptually implements the `IEventService` interface.
    *   For each method in `IEventService`, it uses a `createEventMethod` helper. This helper function:
        *   Calls `window.electron.ipcRenderer.invoke(channelName, ...args)`, where `channelName` matches the method name.
        *   Awaits the Promise returned by `invoke`.
        *   If the result from the main process is an `Error` object, it throws a new `MainProcessError` (from `src/renderer/error/MainProcessError.ts`) to distinguish it from renderer-side errors.
        *   Otherwise, it returns the successful result.
    *   It also provides methods for listening to (`on`) and emitting (`emit`) general IPC events that are not part of the request/response pattern (e.g., `before-close`, `ready-to-close` for application shutdown).
*   **Responsibilities**:
    *   Abstracts away the raw `ipcRenderer` calls.
    *   Provides type safety for IPC calls based on `IEventService`.
    *   Handles error wrapping for responses from the main process.

## `IEventService` Interface

*   **Location**: `src/shim/event-service.ts`
*   **Purpose**: Defines the contract for methods that are exposed via IPC. This shared interface ensures that both `MainEventService` and `RendererEventService` are synchronized in terms of method signatures and channel names.
*   **Key Methods Defined**:
    *   `loadCollection`, `listCollections`
    *   `sendRequest`
    *   `saveRequest`, `saveChanges`, `discardChanges`
    *   `deleteObject`
    *   `getAppVersion`
    *   `getActiveEnvironmentVariables`, `getVariable`, `setCollectionVariables`
    *   `selectEnvironment`
    *   `saveFolder`
    *   `openCollection`, `createCollection`, `closeCollection`
    *   `showOpenDialog`

## Overall Flow

1.  Renderer component/service needs to perform a main process task (e.g., save a file).
2.  It calls a method on `RendererEventService.instance` (e.g., `RendererEventService.instance.saveRequest(requestData)`).
3.  `RendererEventService` uses `window.electron.ipcRenderer.invoke('saveRequest', requestData)` to send the request to the main process.
4.  `MainEventService` (which has a handler registered for `'saveRequest'`) receives the call.
5.  The handler in `MainEventService` calls the actual implementation (e.g., `PersistenceService.instance.saveRequest(requestData)`).
6.  The result (or an error) from `PersistenceService` is returned by the `MainEventService` handler.
7.  `RendererEventService` receives the result. If it's an error, it throws `MainProcessError`; otherwise, it returns the data.
8.  The original caller in the renderer process receives the data or catches the error.

This structured approach to IPC ensures maintainability, type safety, and proper error handling between the main and renderer processes.
For more details on the underlying IPC mechanisms, see [IPC Communication]({% link documentation/architecture/ipc-communication.md %}). 
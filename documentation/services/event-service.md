---
title: Event Service (IPC)
nav_order: 2
parent: Services
description: MainEventService and RendererEventService, the two ends of the typed IPC contract.
---

# Event Service (IPC)

The event service is the IPC contract between the processes. It is one interface, `IEventService` in `src/shim/event-service.ts`, implemented twice: `MainEventService` handles the calls in main, and `RendererEventService` makes them from the renderer. How messages travel is described in [IPC Communication]({% link documentation/architecture/ipc-communication.md %}).

## `MainEventService`

**Location**: `src/main/event/main-event-service.ts`

- Its constructor registers an `ipcMain.handle()` handler for every method on its prototype, with the method name as the channel. Every method there is callable from the renderer; helpers belong outside the class.
- Each handler runs in `toIpcResult()`, which returns `{ ok: true, value }` or logs the error and returns `{ ok: false, error }`, see [Error Handling]({% link documentation/architecture/error-handling.md %}).
- The methods are thin: they delegate to the services, e.g. `dispatch()` to the `CollectionStateService`, `sendRequest()` to the `HttpService`, `importCollection()` to the `ImportService`.
- It pushes events to the renderer. It listens to the services and forwards their changes through `sendToRenderer()`: patches of the collection state, changed request files, the history, the plugins, and the status and actions of the MCP server.
- `window` is the main `BrowserWindow`, set in `main.ts`. It receives the events and is the parent of the file dialogs.
- Importing it also registers the stream handlers (`stream-events.ts`).

## `RendererEventService`

**Location**: `src/renderer/services/event/renderer-event-service.ts`

- A singleton (`RendererEventService.instance`) whose methods are created with `createEventMethod(name)`. Each calls `window.electron.ipcRenderer.invoke(name, ...args)` and returns the value or throws the error of the `IpcResult`.
- `on(event, listener)` and `removeListener(event, listener)` subscribe to a `MainProcessEvent`; `emit(event, ...payload)` sends a `RendererEvent`. All three are typed by the payload maps, and return the service, so calls can be chained.

```ts
const eventService = RendererEventService.instance;

const version = await eventService.getAppVersion();

eventService
  .on(MainProcessEvent.HistoryChanged, onHistoryChanged)
  .on(MainProcessEvent.PluginsChanged, onPluginsChanged);
```

## The calls

`IEventService` documents every method. By area:

| Area | Methods |
| --- | --- |
| Collection state | `getCollectionState`, `dispatch`, `saveCollectionUiState`, `flushCollection`, `reloadCollection`, `reloadCollectionIfChanged` |
| Collections | `listCollections`, `openCollection`, `createCollection`, `closeCollection`, `importCollection`, `exportCollection` |
| Requests | `sendRequest`, `abortRequest`, `discoverOAuth2Endpoints`, `downloadBody` |
| Variables | `getActiveEnvironmentVariables`, `getVariable`, `resolveVariablesInString` |
| History | `getHistory`, `getHistoryEntry`, `clearHistory` |
| Settings and app | `getAppSettings`, `saveAppSettings`, `getAppVersion`, `openLogDirectory`, `showOpenDialog`, `showSaveDialog` |
| Plugins | `getPlugins`, `setPluginEnabled` |
| MCP server | `getMcpServerStatus`, `getMcpToken`, `regenerateMcpToken` |

Most edits of a collection do not have a method of their own: they are commands sent with `dispatch()`, see [Main-Owned Collection State]({% link documentation/architecture/collection-state.md %}).

## Adding a call

1. Add the method with a doc comment to `IEventService`.
2. Implement it in `MainEventService`, delegating to a service.
3. Add `methodName = createEventMethod('methodName')` to `RendererEventService`.

Both classes implement the interface, so the compiler reports a missing method. Parameters are typed with their real types and not validated again, as both sides are type-checked together. Validate with Zod only where the schema adds defaults, transforms or structural rules.

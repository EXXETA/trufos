---
title: IPC Communication
nav_order: 3
parent: Architecture
description: The typed contract between the main and renderer processes, the events main pushes and how bodies are streamed.
---

# IPC Communication

The main and renderer processes run in isolation and talk through Electron's IPC. Trufos uses three kinds of messages, all typed in `src/shim/event-service.ts`:

1. **Calls** from the renderer to main, which return a result: the methods of `IEventService`.
2. **Events** that main pushes to the renderer (`MainProcessEvent`) and that the renderer sends to main (`RendererEvent`), with no answer.
3. **Streams** of bodies and scripts from main to the renderer.

Both processes are built and type-checked together, so the IPC boundary is not validated with Zod by default. Handlers take their real parameter types. Zod is only used where the schema adds something beyond the type, e.g. the command envelope of `dispatch()`.

## Preload script

`src/main/preload.ts` exposes a small API as `window.electron` through `contextBridge`:

- `ipcRenderer`: `send`, `sendSync`, `on`, `once`, `invoke` and `removeListener`, bound to Electron's `ipcRenderer`.
- `getAbsoluteFilePath(file)`: the path of a dropped or picked `File`, through `webUtils.getPathForFile()`.

`src/renderer/preload.d.ts` types `window.electron` for the renderer. Renderer code does not use `window.electron.ipcRenderer` directly, except for streams; it goes through the `RendererEventService`.

## Calls

`IEventService` lists every call, e.g. `getCollectionState()`, `dispatch(envelope)`, `sendRequest(requestId, abortKey)`, `openCollection(dirPath)`, `importCollection(...)` or `getMcpToken()`. Each method has a doc comment in the interface.

- **Main**: the constructor of `MainEventService` (`src/main/event/main-event-service.ts`) calls `ipcMain.handle(name, …)` for every method on its prototype, with the method name as the channel. Every method on that class can be called by the renderer, so helpers do not belong there.
- **Renderer**: `RendererEventService` (`src/renderer/services/event/renderer-event-service.ts`) implements the same interface with `createEventMethod(name)`, which calls `ipcRenderer.invoke(name, ...args)`.

Electron reduces an error thrown in `ipcMain.handle()` to a prefixed message, so errors are returned as part of the result instead:

```ts
type IpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: SerializedDisplayableError | Error };
```

Main wraps every handler in `toIpcResult()`, which logs an error and returns it. A `DisplayableError` is sent serialized, so its title and description survive. The renderer returns `value` or throws: a deserialized `DisplayableError`, or a `MainProcessError` with the message of any other error. See [Error Handling]({% link documentation/architecture/error-handling.md %}).

To add a call, add the method to `IEventService`, implement it in `MainEventService` and add `name = createEventMethod('name')` to `RendererEventService`. The compiler reports a method missing from either class.

## Events

`MainProcessEvent` lists what main pushes to the renderer, and `MainProcessEventPayloads` types the payload of each:

| Event | Payload | Purpose |
| --- | --- | --- |
| `before-close` | none | The window is closing; flush unsaved state |
| `collection-state-changed` | `CollectionStateEvent` | Patches or a snapshot of the open collection |
| `request-files-changed` | request IDs | Text bodies or scripts changed on disk; reload the editors |
| `history-changed` | history summaries | The request history of the current collection |
| `plugins-changed` | `PluginsSnapshot` | A plugin was enabled, disabled or failed |
| `mcp-server-status-changed` | `McpServerStatus` | The MCP server started, stopped or failed |
| `response-received` | request ID, response | A request was sent outside the renderer, e.g. by an MCP client |
| `show-request` | request ID | Select a request, e.g. for an MCP client |
| `reload-collection`, `show-app-settings`, `show-collection-settings`, `show-collection-runner`, `show-history` | none | Entries of the native menu |

Main sends every event through `sendToRenderer(webContents, event, ...payload)` (`src/main/event/send-to-renderer.ts`), which types the payload. The renderer listens with `RendererEventService.instance.on(event, listener)`; a listener gets the Electron event first, then the payload.

`RendererEvent` lists what the renderer sends to main: `log` (a log entry), `renderer-ready` (the window can be shown) and `ready-to-close` (the renderer flushed its state). The renderer sends them with `RendererEventService.instance.emit(event, ...payload)`.

## Streams

Bodies can be large, so they are never sent in one message. `src/main/event/stream-events.ts` handles a `stream-open` call whose input (`StreamInput`, `src/shim/ipc-stream.ts`) is one of:

- a file path,
- `{ type: 'request-body', requestId }`: the text body of a request of the open collection, from its draft if it has one,
- `{ type: 'script', source, requestId }`: a pre-request or post-response script,
- `{ type: 'body', id }`: a body of the `BodyStore`, e.g. a response.

Main opens a Node.js stream, returns an ID and sends its chunks as `stream-data`, followed by `stream-end` or `stream-error`. The renderer can stop it with `stream-close`. Request bodies and scripts are opened on the queue of the collection state, so no write interleaves with the read. An optional `maxBytes` reads only the beginning, e.g. to show a preview of a large response.

In the renderer, `IpcPushStream` (`src/renderer/lib/ipc-stream.ts`) wraps this: `IpcPushStream.open(input, encoding, maxBytes?)` returns an event emitter with `data`, `end` and `error`, and `readAll()` collects the stream into a string. The `useBodyData()` hook uses it to show a body.

A body is only read completely where it has to be in memory anyway, e.g. in an editor. Saving a response to a file (`downloadBody()`) happens in main, so the body never passes through the renderer.

---
title: Error Handling
nav_order: 9
parent: Architecture
description: How errors are typed, how they cross from the main process to the renderer and how they are shown to the user.
---

# Error Handling

Errors in Trufos are logged where they happen and, if a user action caused them, shown as a toast. Errors from the main process reach the renderer as part of the IPC result.

## Error types

| Class | Location | Purpose |
| --- | --- | --- |
| `DisplayableError` | `src/shim/error/DisplayableError.ts` | An error meant for the user, with a `title` and a `description`. Usable in both processes. |
| `MainProcessError` | `src/renderer/error/MainProcessError.ts` | Any other error that came from the main process over IPC; only its message survives. |
| `InternalError` | `src/main/error/internal-error.ts` | A main-process error with an `InternalErrorType`, e.g. `COLLECTION_LOAD_ERROR` or `UNSUPPORTED_IMPORT_STRATEGY`. |
| `CollectionChangedError` | `src/main/collection-state/collection-state-service.ts` | A change was meant for a collection that is no longer open. A `DisplayableError`. |

Throw a `DisplayableError` wherever you can tell the user what went wrong and what to do, e.g. `new DisplayableError('The variable "host" used in the URL is not defined.', 'Undefined Variable')`. Without a title, it is "Unexpected Error".

## From main to the renderer

Every IPC handler of the `MainEventService` runs in `toIpcResult()`, which catches any error, logs it with the main-process logger and returns it as `{ ok: false, error }`:

- a `DisplayableError` is serialized with `serialize()` into a plain object with `title` and `description`, as only plain data survives structured cloning. Its `cause` is dropped.
- any other error is returned as an `Error`, of which only the message arrives.

The `RendererEventService` throws on `ok: false`: a `DisplayableError` restored with `DisplayableError.deserialize()`, or a `MainProcessError` with the message. See [IPC Communication]({% link documentation/architecture/ipc-communication.md %}#calls).

## Network errors

When a request fails, `mapRequestError()` (`src/main/network/service/request-error.ts`) turns the error of undici or Node.js into a `DisplayableError` with an explanation, e.g. for an invalid URL, a host that cannot be resolved, a refused connection or a certificate that cannot be verified. Failures of authentication, an undefined variable in the URL and failed OAuth 2.0 discovery are `DisplayableError`s as well. The renderer's `HttpService` wraps anything else in a generic "Could not send Request" error.

## Showing errors

`showError()` (`src/renderer/error/errorHandler.ts`) logs an error and shows it as an error toast with [sonner](https://sonner.emilkowal.ski/):

```ts
showError(error);                        // a DisplayableError shows its description
showError('Failed to save app settings', error); // otherwise, pass the message to show
```

Actions catch their own errors and call `showError()`, so components do not need `try`/`catch`:

- the async actions of the collection store show the error and resolve to `false`;
- `useSendRequest()` and `useSaveRequest()` never throw;
- the history, plugin and app settings stores show failures of their IPC calls.

## Main-process failures

- An uncaught exception or unhandled rejection in main shows an error dialog and quits the app (`main.ts`).
- If a write of the open collection fails, main reloads the collection from disk and broadcasts it, so the renderer shows what is actually stored.
- A plugin that throws never takes the app down: `PluginService` logs the error with the plugin ID and surfaces it as a `DisplayableError`; a plugin that fails to activate is disabled for the session.

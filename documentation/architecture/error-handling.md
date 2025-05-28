---
title: Error Handling
nav_order: 6
parent: Architecture Overview
---

# Error Handling

Effective error handling is crucial for a stable and user-friendly application. Trufos employs a multi-layered approach to manage and communicate errors that occur in both the main and renderer processes.

## Custom Error Types

Trufos defines several custom error classes to provide more context and facilitate specific error handling logic:

1.  **`InternalError` (`src/main/error/internal-error.ts`)**:
    *   **Scope**: Main Process.
    *   **Purpose**: Represents errors originating from within Trufos's main process logic that are not typically direct results of user input validation (e.g., issues saving/loading collections, unsupported import strategies).
    *   **Properties**:
        *   `type`: An `InternalErrorType` enum (e.g., `COLLECTION_LOAD_ERROR`, `UNSUPPORTED_IMPORT_STRATEGY`) for categorizing the error.
        *   `message`: A descriptive error message.
        *   `cause` (optional): The underlying error that caused this `InternalError`.

2.  **`MainProcessError` (`src/renderer/error/MainProcessError.ts`)**:
    *   **Scope**: Renderer Process.
    *   **Purpose**: Wraps errors that originated in the main process and were passed to the renderer process via IPC. This helps distinguish them from errors originating solely within the renderer.
    *   **Properties**:
        *   `message`: The message from the original main process error.

3.  **`DisplayableError` (`src/renderer/error/DisplayableError.ts`)**:
    *   **Scope**: Renderer Process.
    *   **Purpose**: Represents errors that are intended to be shown directly to the user, typically via a toast notification.
    *   **Properties**:
        *   `title`: A concise title for the error display (defaults to "Unexpected Error").
        *   `description`: A more detailed description of the error for the user (defaults to "See the console for more information.").
        *   `cause` (optional): The underlying error.
    *   **Static Defaults**: `DEFAULT_TITLE` and `DEFAULT_DESCRIPTION` provide generic messages.

## Error Propagation and Display

### Main Process Errors

*   **Catching and Wrapping**: In `src/main/event/main-event-service.ts`, IPC handlers use a `wrapWithErrorHandler` utility. This utility catches any synchronous or asynchronous errors thrown by the underlying service methods.
*   **Returning to Renderer**: If an error is caught, `wrapWithErrorHandler` converts it to a standard `Error` object (if it isn't one already) and returns it as the result of the IPC `invoke` call.
    ```typescript
    // Simplified from MainEventService
    ipcMain.handle(functionName, async (_event, ...args) => {
      try {
        return await actualServiceMethod(...args);
      } catch (error) {
        logger.error(error); // Log the error in the main process
        return toError(error); // Convert to standard Error object for IPC
      }
    });
    ```

### Renderer Process Error Handling

1.  **`RendererEventService` (`src/renderer/services/event/renderer-event-service.ts`)**:
    *   When an IPC call (e.g., `window.electron.ipcRenderer.invoke(...)`) returns, the service checks if the `result` is an instance of `Error`.
    *   If it is, a new `MainProcessError` is thrown, wrapping the message from the received error.
        ```typescript
        // Simplified from RendererEventService's createEventMethod
        async function ipcCallWrapper(...args) {
          const result = await window.electron.ipcRenderer.invoke(channel, ...args);
          if (result instanceof Error) {
            throw new MainProcessError(result.message);
          }
          return result;
        }
        ```

2.  **`HttpService` (Renderer) (`src/renderer/services/http/http-service.ts`)**:
    *   The `sendRequest` method in the renderer's `HttpService` calls the corresponding `RendererEventService` method.
    *   It catches errors (including `MainProcessError`) and re-throws them as `DisplayableError` instances, often providing more user-friendly descriptions based on common error messages (e.g., "invalid url", "getaddrinfo ENOTFOUND").

3.  **`useErrorHandler` Hook (`src/renderer/components/ui/use-toast.ts`)**:
    *   This custom React hook is designed to wrap functions (typically event handlers or async operations in components).
    *   It executes the wrapped function in a `try...catch` block.
    *   If an error is caught:
        *   It logs the error to the console.
        *   It uses the `toast` function (also from `use-toast.ts`) to display an error notification.
        *   If the error is a `DisplayableError`, its `title` and `description` are used for the toast.
        *   Otherwise, default error messages from `DisplayableError.DEFAULT_TITLE` and `DisplayableError.DEFAULT_DESCRIPTION` are used.
    *   **Usage Example** (from `MainTopBar.tsx`):
        ```typescript
        const sendRequest = useCallback(
          useErrorHandler(async () => { // Wrapped function
            // ... logic to prepare and send request ...
            if (!request.url || !request.method) {
              setHasError(true);
              throw new Error('Missing URL or HTTP method'); // This will be caught
            }
            // ...
            const response = await httpService.sendRequest(request); // httpService might throw DisplayableError
            addResponse(request.id, response);
          }),
          [request, requestEditor, addResponse]
        );
        ```

## Toast Notifications

*   The `useToast` hook and `Toaster` component (`src/renderer/components/ui/use-toast.ts` and `toaster.tsx`) manage the display of toast notifications.
*   Errors caught by `useErrorHandler` are presented to the user as "destructive" variant toasts.

This system ensures that errors are logged appropriately, propagated across process boundaries if necessary, and presented to the user in a non-disruptive way when possible.

See [IPC Communication]({% link documentation/architecture/ipc-communication.md %}) and [Event Service]({% link documentation/services/event-service.md %}) for more details. 
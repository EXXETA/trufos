---
title: State Management
nav_order: 4
parent: Architecture Overview
---

# State Management

Trufos primarily manages its application state within the **Renderer process** using [Zustand](https://github.com/pmndrs/zustand), a small, fast, and scalable state-management solution. Zustand is chosen for its simplicity, hook-based API, and compatibility with React.

## Core Stores

The application state is divided into several stores, each responsible for a specific domain:

1.  **`CollectionStore` (`src/renderer/state/collectionStore.ts`)**:
    *   **Purpose**: Manages the state related to the currently loaded collection, including its structure (folders, requests), the currently selected request, and the Monaco editor instance for the request body.
    *   **Key State Properties**:
        *   `collection`: Basic information about the current collection (ID, title, children).
        *   `requests`: A `Map` of all requests in the collection, keyed by their ID.
        *   `folders`: A `Map` of all folders in the collection, keyed by their ID.
        *   `selectedRequestId`: The ID of the request currently being viewed/edited.
        *   `requestEditor`: The Monaco editor instance for the request body.
        *   `openFolders`: A `Set` of folder IDs that are currently expanded in the sidebar's request list.
    *   **Key Actions**:
        *   `initialize(collection)`: Loads a new collection into the store, populating `requests` and `folders` maps.
        *   `changeCollection(collection)`: Switches to a new collection, ensuring unsaved changes in the current request are persisted.
        *   `addNewRequest(title?, parentId?)`: Creates a new request, saves it via `RendererEventService`, and updates the store.
        *   `updateRequest(updatedRequest, overwrite?)`: Updates the currently selected request. Can either merge partial updates (marking as draft) or fully overwrite.
        *   `setRequestBody(body)`: Updates the body of the current request.
        *   `setRequestEditor(editor?)`: Sets the Monaco editor instance and loads the current request's body into it. Handles draft status on content change.
        *   `setSelectedRequest(id?)`: Changes the selected request, saving the previous one if necessary and loading the new one's body.
        *   `deleteRequest(id)`: Deletes a request from the store and via `RendererEventService`.
        *   `renameRequest(id, title)`: Renames a request.
        *   Header and Query Parameter management actions (`addHeader`, `updateHeader`, `deleteHeader`, `clearHeaders`, etc.).
        *   `setDraftFlag()`: Marks the current request as having unsaved changes.
        *   Folder management actions (`addNewFolder`, `deleteFolder`, `renameFolder`, `setFolderOpen`, `setFolderClose`).
    *   **IPC Integration**: Listens for the `'before-close'` IPC event from the main process to save any unsaved changes in the `requestEditor` before the application quits.

2.  **`ResponseStore` (`src/renderer/state/responseStore.ts`)**:
    *   **Purpose**: Manages the HTTP responses received for requests.
    *   **Key State Properties**:
        *   `responseInfoMap`: A `Record` (object) mapping request IDs to their corresponding `TrufosResponse` objects.
        *   `editor`: The Monaco editor instance for displaying the response body.
    *   **Key Actions**:
        *   `addResponse(requestId, response)`: Adds a new response to the map.
        *   `removeResponse(requestId)`: Removes a response.
        *   `setResponseEditor(editor?)`: Sets the Monaco editor instance for the response view.

3.  **`VariableStore` (`src/renderer/state/variableStore.ts`)**:
    *   **Purpose**: Manages collection-level variables, primarily for use in the Settings modal. See [Variables documentation]({% link documentation/user-guide/variables.md %}) for more details on variable types and usage.
    *   **Key State Properties**:
        *   `variables`: A `VariableMap` (object) representing the collection's variables.
    *   **Key Actions**:
        *   `initialize(variables)`: Sets the initial variables when a collection is loaded.
        *   `setVariables(variables)`: Updates the variables and persists them via `RendererEventService`.

## Zustand Configuration

*   **`immer` Middleware**: All stores use the `immer` middleware from Zustand (`zustand/middleware/immer`). This allows for direct, "mutable" updates to state within action definitions, which Immer then translates into immutable updates.
*   **`enableMapSet()`**: Called in `src/renderer/index.tsx` from `immer` to enable direct mutation support for `Map` and `Set` objects within Immer-powered reducers/actions.

## State Selection and Actions

*   **Selectors**: Each store typically exports selector functions (e.g., `selectRequest` in `collectionStore.ts`) to retrieve specific pieces of state.
*   **`useActions()` Hook**: A utility hook (`src/renderer/state/helper/util.ts`) is used to conveniently access all action functions from a store, often with shallow equality checking for performance:
    ```typescript
    // Example usage
    const { addNewRequest, updateRequest } = useCollectionActions();
    ```

## Data Flow

1.  **Initialization**: On app start, `RendererEventService.loadCollection()` fetches the last opened collection. The `CollectionStore` is initialized with this data. `VariableStore` is initialized with the collection's variables.
2.  **User Interaction**: User actions in the UI (e.g., typing in URL, changing HTTP method, sending request) call actions in the relevant Zustand store.
3.  **State Update**: Store actions update the state immutably (thanks to Immer).
4.  **IPC for Persistence/Operations**: If an action requires main process interaction (e.g., saving a request, sending an HTTP request), it calls methods on `RendererEventService`.
5.  **UI Re-render**: React components subscribed to store changes (via hooks like `useCollectionStore(...)`) re-render with the new state.
6.  **Response Handling**: When an HTTP response is received (via `RendererEventService`), the `ResponseStore.addResponse` action is called to update the response state.

This architecture keeps the UI reactive to state changes and centralizes business logic within the Zustand stores and associated services. 
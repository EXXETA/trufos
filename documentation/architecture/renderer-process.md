---
title: Renderer Process
nav_order: 2
parent: Architecture Overview
---

# Renderer Process

The Renderer process in Trufos is responsible for displaying the user interface. Each `BrowserWindow` instance in Electron runs its own renderer process. Trufos primarily uses one main window. The renderer process does not have direct access to Node.js APIs or native OS functionalities for security reasons; it communicates with the Main process via [IPC (Inter-Process Communication)]({% link documentation/architecture/ipc-communication.md %}) to perform such tasks.

## Entry Point & UI Framework

*   **Entry Point**: `src/renderer/index.tsx`
    *   Initializes `immer` for MapSet support.
    *   Sets up global renderer-side logging (`src/renderer/logging/console.ts`) which forwards logs to the main process.
    *   Dynamically imports Monaco editor configuration (`src/renderer/lib/monaco/config.js`) to improve startup time.
    *   Initializes the `CollectionStore` by fetching the initial collection data from the main process via `RendererEventService`.
    *   Renders the root React component (`App.tsx`) into the `index.html`'s `#root` div.
*   **UI Framework**: [React](https://react.dev/) with TypeScript.
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) (`tailwind.config.js`, `src/renderer/styles/tailwind.css`) and global CSS (`src/renderer/styles/global.css`).
*   **UI Components**: Primarily uses [ShadCN UI](https://ui.shadcn.com/) components (configured in `components.json` and located in `src/renderer/components/ui/`), supplemented by custom components.

## Root Component and Views

*   **`App.tsx` (`src/renderer/App.tsx`)**: The root React component.
    *   Sets up global providers like `TooltipProvider` and `SidebarProvider`.
    *   Defines the main layout using `Menubar` and `RequestWindow`.

*   **Views (`src/renderer/view/`)**:
    *   `Menubar.tsx`: The main sidebar containing collection management, request list, and footer bar.
    *   `RequestWindow.tsx`: The main content area, displaying either an empty state or the request/response interface (`MainTopBar`, `MainBody`).
    *   `UILibrary.tsx`: A development/debug view for showcasing UI components (likely not part of the production UI flow).

## Key Components and Functionality

*   **Main Window Structure (`src/renderer/components/mainWindow/`)**:
    *   `MainTopBar.tsx`: Contains the HTTP method selector, URL input, send button, and save button.
    *   `MainBody.tsx`: Organizes the input and output tabs for request and response details.
    *   `InputTabs/` & `OutputTabs/`: Manage the tabbed interface for request parameters (body, query params, headers) and response details (body, headers, status).
    *   `ResponseStatus.tsx`: Displays HTTP status, duration, and size of the response.

*   **Sidebar (`src/renderer/components/sidebar/`)**:
    *   `SidebarHeaderBar.tsx`: Collection dropdown, "New Folder", "New Request" buttons.
    *   `SidebarRequestList/`: Renders the tree view of folders and requests within the current collection. Uses recursive components like `NavFolder.tsx` and `NavRequest.tsx`.
    *   `FooterBar.tsx`: Displays app version, GitHub link, and settings modal trigger.

*   **Monaco Editor Integration (`src/renderer/lib/monaco/`)**:
    *   Configuration (`config.js`): Sets up Monaco workers and initializes the loader.
    *   Language Support (`language.ts`): Registers custom language features for template variables (semantic highlighting, completion items, hover providers).
    *   Providers:
        *   `TemplateVariableSemanticTokensProvider.ts`: Highlights `{{variable}}` syntax.
        *   `TemplateVariableCompletionItemsProvider.ts`: Suggests available variables.
        *   `TemplateVariableHoverProvider.ts`: Shows variable values on hover.
    *   The editor instances are used in `BodyTab.tsx` (for request body) and `OutputTabs.tsx` (for response body). Options are defined in `src/renderer/components/shared/settings/monaco-settings.ts`.

*   **State Management (`src/renderer/state/`)**:
    *   Uses [Zustand](https://zustand-demo.pmnd.rs/) for global state.
    *   `collectionStore.ts`: Manages the current collection's structure, selected request, open folders, and request editor instance.
    *   `responseStore.ts`: Stores responses for requests.
    *   `variableStore.ts`: Manages collection-level variables for the settings modal.
    *   See [State Management]({% link documentation/architecture/state-management.md %}) for more details.

*   **Services (`src/renderer/services/`)**:
    *   `RendererEventService.ts`: A wrapper around `window.electron.ipcRenderer` to communicate with the main process. See [IPC Communication]({% link documentation/architecture/ipc-communication.md %}).
    *   `HttpService.ts`: A thin wrapper around `RendererEventService.sendRequest` to handle HTTP requests, primarily for error display.
    *   `StyleHelper.ts`: Provides utility functions for styling, e.g., HTTP method colors.

*   **Error Handling (`src/renderer/error/`)**:
    *   `DisplayableError.ts`: Custom error class for errors that can be shown to the user (e.g., in toasts).
    *   `MainProcessError.ts`: Represents errors originating from the main process.
    *   `useErrorHandler.ts` (in `src/renderer/components/ui/use-toast.ts`): A hook that wraps functions to automatically display toasts on errors.

## Build Configuration

The renderer process code is built using Vite, as configured in `src/renderer/vite.config.ts`. This configuration includes:
*   React plugin (`@vitejs/plugin-react`).
*   Aliases for easier imports (e.g., `@/` for `src/renderer/`).
*   Vitest configuration for testing, including an alias for Monaco editor to ensure tests can run in a JSDOM environment. 
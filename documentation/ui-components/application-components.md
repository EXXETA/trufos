---
title: Application Components
nav_order: 2
parent: UI Components
---

# Application Components

Beyond the [Core UI Elements]({% link documentation/ui-components/core-elements.md %}), Trufos has several higher-level components tailored to its specific functionality as a REST client. These components often combine core elements and implement application-specific logic.

## Main Window Components (`src/renderer/components/mainWindow/`)

These components make up the primary interaction area of the application when a request is selected.

*   **`MainTopBar.tsx`**:
    *   **Purpose**: The bar at the top of the request window containing essential request controls.
    *   **Composition**: Uses `HttpMethodSelect`, `UrlInput`, `SaveButton`, and `SendButton`.
    *   **Logic**: Handles URL changes, HTTP method selection, initiating requests (via `HttpService` and `RendererEventService`), and saving requests (persisting drafts). Integrates with `useErrorHandler` for displaying errors from these operations. Listens for `Ctrl/Cmd + S` to save draft requests.

*   **`UrlInput.tsx`**:
    *   **Purpose**: A specialized `Input` component for the request URL.
    *   **Features**: Styled for URL input, includes error state styling.

*   **`HttpMethodSelect.tsx`**:
    *   **Purpose**: A `Select` component tailored for choosing HTTP methods (`GET`, `POST`, etc. from `RequestMethod` enum).
    *   **Features**: Dynamically styles the selected method text based on its type (e.g., GET is green, POST is blue) using `httpMethodColor` from `StyleHelper.ts`. Custom trigger styling.

*   **`SendButton.tsx`**:
    *   **Purpose**: A `Button` component to trigger sending the HTTP request.
    *   **Features**: Includes an "ArrowForwardIcon".

*   **`SaveButton.tsx`**:
    *   **Purpose**: A `Button` component to save the current request (if it's a draft).
    *   **Features**: Uses a "BookmarkIcon". Disabled if the request is not a draft.

*   **`MainBody.tsx`**:
    *   **Purpose**: The main content area below the `MainTopBar`, dividing the space for request input and response output.
    *   **Layout**: Arranges `InputTabs` and `OutputTabs` in a flexible row (or column on smaller screens, though primarily desktop-focused).

*   **`InputTabs.tsx` (`src/renderer/components/mainWindow/bodyTabs/InputTabs/`)**:
    *   **Purpose**: Provides a tabbed interface for configuring different parts of an HTTP request.
    *   **Tabs**:
        *   **`BodyTab.tsx`**: Manages request body input. Uses a Monaco editor for text-based bodies and a file input for file bodies. Allows selection of body type (Text, File) and language (JSON, XML, Plain for text bodies) using `SimpleSelect.tsx`.
        *   **`HeaderTab.tsx`**: Manages request headers. Provides a table-like interface to add, edit, delete, and toggle (activate/deactivate) headers.
        *   **`ParamsTab.tsx`**: Manages URL query parameters. Similar table-like interface for query parameters. Synchronizes with the URL in `MainTopBar.tsx`.
    *   **Features**: Uses `Tabs`, `Table`, `Input`, `Button`, `AddIcon`, `DeleteIcon`, `CheckedIcon` components. Active header count is displayed in the "Headers" tab trigger.

*   **`SimpleSelect.tsx` (`src/renderer/components/mainWindow/bodyTabs/InputTabs/`)**:
    *   **Purpose**: A generic, simplified `Select` component used within `InputTabs` (e.g., for body type, language selection).

*   **`OutputTabs.tsx` (`src/renderer/components/mainWindow/bodyTabs/`)**:
    *   **Purpose**: Displays the HTTP response.
    *   **Tabs**:
        *   **"Response Body"**: Displays the response body using a read-only Monaco editor. The language for syntax highlighting is determined from the `Content-Type` header. Fetches body content via `IpcPushStream`.
        *   **"Headers"**: Displays response headers in a table.
    *   **Features**: Includes `ResponseStatus` in its tab list area.

*   **`ResponseStatus.tsx` (`src/renderer/components/mainWindow/responseStatus/`)**:
    *   **Purpose**: Displays key information about the HTTP response: status code (with color coding), time taken, and total size.
    *   **Features**: Uses `getHttpStatusText`, `getHttpStatusColorClass`, `getDurationTextInSec`, `getSizeText` from `ResponseStatusFormatter.ts` for formatting. Includes a tooltip to show header and body size breakdown.

## Sidebar Components (`src/renderer/components/sidebar/`)

These components constitute the application's main navigation and collection management sidebar.

*   **`SidebarHeaderBar.tsx`**:
    *   **Purpose**: The header section of the sidebar.
    *   **Features**: Contains the `CollectionDropdown` for switching/creating/opening collections, and buttons for creating new folders and requests at the root of the current collection. Uses `NamingModal` for these creation actions.

*   **`CollectionDropdown.tsx`**:
    *   **Purpose**: A dropdown menu for managing collections.
    *   **Features**: Lists available collections (fetched via `RendererEventService`), allows opening existing collections (via file dialog), and creating new collections (via directory selection dialog). Updates `CollectionStore` upon selection.

*   **`SidebarRequestList/`**:
    *   **`SidebarRequestList.tsx`**: The main container that renders the tree of folders and requests from the `CollectionStore`.
    *   **`NavFolder.tsx`**: Renders a collapsible folder item. Uses the core `Collapsible` component and `SidebarMenuSubButton`. Recursively calls `renderChildren` for its contents. Includes a `FolderDropdown`.
    *   **`NavRequest.tsx`**: Renders a request item. Uses `SidebarMenuSubButton` and `RequestView`.
    *   **`RequestView.tsx`**: Displays the actual content for a request item in the list (HTTP method, title). Includes a `RequestDropdown`.
    *   **`Dropdown/FolderDropdown.tsx` & `RequestDropdown.tsx`**: Context menus for folders and requests respectively. Provide actions like Add Request/Folder (for folders), Rename, and Delete. Uses `NamingModal`.
    *   **`Dropdown/modals/NamingModal.tsx`**: A dialog component used for naming new folders/requests or renaming existing ones.

*   **`FooterBar.tsx`**:
    *   **Purpose**: The footer section of the sidebar.
    *   **Features**: Displays the application version (fetched via `RendererEventService`), a link to the GitHub repository, and a trigger for the `SettingsModal`.

## Shared Components (`src/renderer/components/shared/`)

*   **`Divider.tsx`**: A simple horizontal or vertical divider line.
*   **`settings/SettingsModal.tsx`**:
    *   **Purpose**: A dialog for configuring application settings. Currently, it primarily handles collection-level variables. See [Variables documentation]({% link documentation/user-guide/variables.md %}) for more details on variable types and usage.
    *   **Tabs**: Uses `Tabs` to organize settings sections.
    *   **`VariableTab/VariableEditor.tsx`**: A reusable component for editing key-value pairs (variables), including description. Handles validation for variable names.
    *   **Logic**: Loads variables from `VariableStore`, allows editing, and saves them back via `RendererEventService`.

## Other Notable UI Elements

*   **`EmptyWildWest.tsx` (`src/renderer/assets/`)**: An SVG component displayed in the `RequestWindow` when no request is selected, prompting the user to create or select one.
*   **Icons (`src/renderer/components/icons/`)**: A set of custom SVG icons wrapped as React components (e.g., `AddIcon`, `DeleteIcon`, `BookmarkIcon`).

These application-specific components, built upon the core UI elements, define the unique user experience of Trufos. 
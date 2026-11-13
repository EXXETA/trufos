---
title: Application Components
nav_order: 2
parent: UI Components
description: The components that make up the Trufos window, from the request editor and sidebar to the settings and the command palette.
---

# Application Components

These components are built from the [Core UI Elements]({% link documentation/ui-components/core-elements.md %}) and the stores. Paths are relative to `src/renderer/`.

## Request window (`components/mainWindow/`)

`view/RequestWindow.tsx` shows the selected request (`MainTopBar` above `MainBody`), the selected history entry (`HistoryEntryView`) or, if nothing is selected, the `EmptyWildWest` illustration.

- **`MainTopBar.tsx`**: the method, the URL and the actions of the request.
  - `mainTopBar/HttpMethodSelect.tsx`: a `Select` of the HTTP methods, coloured by `httpMethodColor()` (`lib/http-method-color.ts`).
  - `mainTopBar/UrlInput.tsx`: a single-line Monaco editor (`lib/monaco/SingleLineEditor.tsx`) with variable highlighting. It parses the URL into base and query parameters and shows the resolved URL.
  - Discard and save buttons, enabled while the request is a draft.
  - `mainTopBar/SendButton.tsx`: sends the request and turns into a cancel button while it is in flight (`useSendRequest()`).
- **`MainBody.tsx`**: request input and response output in two panes.
- **`bodyTabs/InputTabs/InputTabs.tsx`**: the tabs of the request, also reachable with `Ctrl`/`Cmd` + `1` to `5`:
  - **Body** (`tabs/BodyTab.tsx`): the body type (none, text, file, form data) and, for text, the language. Text is edited in Monaco (`BodyTabTextInput.tsx`), files are picked with a `FilePicker` (`BodyTabFileInput.tsx`), form data in `FormDataTab.tsx`.
  - **Query** (`tabs/ParamsTab.tsx`): query parameters, kept in sync with the URL.
  - **Headers** (`tabs/HeaderTab/`): the shared `HeaderEditor`, showing inherited and automatic headers next to the request's own.
  - **Auth** (`tabs/AuthorizationTab/`): the shared `AuthorizationEditor`.
  - **Scripts** (`tabs/ScriptTab.tsx`): the pre-request and post-response scripts in Monaco, with types for the `trufos` API.
- **`bodyTabs/OutputTabs.tsx`**: the latest response of the request (`ResponseTabs`), with **Response Body** and **Headers** tabs and the `ResponseStatus`.
  - `OutputTabs/BodyTab.tsx`: streams the body from main (`useBodyData()`), shows it formatted if possible, cuts off large bodies until the user asks for everything, and offers to download it. `TextRenderer` shows text in a read-only Monaco editor, `ImagePrettyRenderer` shows images.
  - `responseStatus/ResponseStatus.tsx`: status code, duration and size, with a tooltip that splits the size into headers and body.

## Sidebar (`components/sidebar/`)

`view/Menubar.tsx` lays out the sidebar: header, the request tree or the history, and the footer.

- **`SidebarHeaderBar.tsx`**: the `CollectionDropdown`, the switch between requests and history, and the toolbar of the current view (`RequestsToolbar` for sorting and adding requests and folders, `HistoryToolbar` for the count and clearing).
- **`CollectionDropdown.tsx`**: switches between the recent collections, and opens `view/CollectionCreate.tsx` and `view/CollectionImport.tsx`.
- **`SidebarRequestList/SidebarRequestList.tsx`**: the tree of folders and requests.
  - `Nav/NavFolder.tsx` and `Nav/NavRequest.tsx` render a folder (collapsible, recursive) and a request; `Nav/RequestView.tsx` shows a request's method and title.
  - `Nav/Dropdown/FolderDropdown.tsx` and `RequestDropdown.tsx`: the "…" menus with add, rename, duplicate, settings and delete. `ContextMenu/RequestContextMenu.tsx` is the right-click menu.
  - `Nav/NavCreateItem.tsx`: the inline row for naming a new request or folder. Renaming uses `shared/InlineRename.tsx`.
  - Drag and drop with [dnd-kit](https://dndkit.com/) reorders items and moves them into folders. `treeUtilities.ts` flattens the tree and works out the drop target.
  - Multi-select with `Ctrl`/`Cmd`-click and `Shift`-click (`types.ts`); `BulkActionBar.tsx` and `BulkDeleteDialog.tsx` act on the selection.
- **`FooterBar.tsx`**: app settings, the GitHub link and the app version.

## History (`components/history/`)

- **`HistoryList.tsx`**: the requests sent in this session, newest first, in the sidebar.
- **`HistoryEntryView.tsx`**: a history entry read-only, laid out like the request editor: the request as it was sent (`HistoryRequestTabs.tsx`) next to its response.
- **`OutcomeBadge.tsx`** shows the status, the error or that the request was cancelled; **`ScriptLogs.tsx`** shows the console output of the scripts.

## Settings (`components/shared/settings/`)

The settings modals are `TabbedDialog`s (`shared/TabbedDialog.tsx`). The collection and folder modals edit a working copy and dispatch it as one command on save.

| Modal | Tabs |
| --- | --- |
| `CollectionSettingsModal.tsx` | General (name, close collection), Variables, Environments, Authorization, Headers, mTLS, Export |
| `FolderSettingsModal.tsx` | Authorization, Headers |
| `AppSettingsModal.tsx` | General (theme, TLS verification, logs), Plugins, MCP Server |

Editors used in several places:

- **`AuthorizationTab/AuthorizationEditor.tsx`**: edits the authorization of a request, folder or collection, including inheritance. The fields of each type are described in `forms.ts` and rendered by `ModularForm.tsx`; `useOAuth2Discovery.ts` fills in the OAuth 2.0 endpoints from the issuer.
- **`shared/headers/HeaderEditor.tsx`**: edits the headers of a request, folder or collection and lists the inherited and automatic ones (`DerivedHeaderRows.tsx`).
- **`VariableTab/VariableEditor.tsx`**, **`EnvironmentTab/EnvironmentEditor.tsx`**: variables, secret variables and environments.
- **`TlsTab/CertificateEditor.tsx`**: the client certificate of a collection.
- **`ExportTab/ExportEditor.tsx`**: ZIP export, optionally with secrets or a password.

## Command palette (`components/commandPalette/`)

`CommandPalette.tsx` opens with `Ctrl`/`Cmd` + `K`. It searches the requests of the collection, grouped by folder, and offers actions such as sending, saving or creating a request, switching the environment and opening the settings. It is built on the `Command` primitive (cmdk). The shortcuts it shows come from `hooks/hotKeys/hotkeys.ts`, the single list of all keyboard shortcuts.

## Other views

- **`view/CollectionRunner.tsx`**: replaces the main layout and sends the checked requests of the collection one after another, with an environment of choice, and shows their results.
- **`view/CollectionImport.tsx`**: opens a Trufos collection or imports one through the importers of the enabled plugins, which come from the plugin store.
- **`view/CollectionCreate.tsx`**: creates a collection in a new directory.

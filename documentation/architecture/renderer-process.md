---
title: Renderer Process
nav_order: 2
parent: Architecture
description: The React app of Trufos, its views, the Monaco editors and how it talks to the main process.
---

# Renderer Process

The renderer runs the user interface: a React 19 app in the main window. It has no Node.js access; everything that touches files, the network or other processes goes through [IPC]({% link documentation/architecture/ipc-communication.md %}) to the main process.

## Entry point

`src/renderer/index.tsx`:

1. Imports `@/logging/console`, which forwards every `console` call to the main process log, see [Logging]({% link documentation/architecture/logging.md %}).
2. Enables Immer's `Map` and `Set` support (`enableMapSet()`), which the stores rely on.
3. Renders `App` into `#root` of `index.html`.

## The `App` component

`src/renderer/App.tsx` sets up the providers and the layout:

- `CollectionStoreProvider` fetches the snapshot of the open collection from main and creates the collection store from it, see [State Management]({% link documentation/architecture/state-management.md %}). Nothing below it renders before the snapshot arrived.
- `ThemeProvider` (`contexts/ThemeContext.tsx`) applies the light, dark or system theme from the app settings.
- `TooltipProvider` and `SidebarProvider` from the UI kit.
- A horizontal `ResizablePanelGroup` (react-resizable-panels) with the sidebar (`view/Menubar.tsx`) and the request window (`view/RequestWindow.tsx`). The panel sizes are kept in `localStorage`. The collection runner (`view/CollectionRunner.tsx`) replaces this layout while it is open.
- The modals: collection settings, folder settings, app settings and the command palette. Whether they are open is kept in the view store.
- The `Toaster` (sonner) that shows notifications and errors.

`App` also listens to the events main pushes for the native menu (open settings, open the runner, show the history), the request history, the plugin list and responses of requests sent by an MCP client. Once the app settings are loaded, it sends `renderer-ready`, and main shows the window.

## Views

| View | Purpose |
| --- | --- |
| `Menubar.tsx` | The sidebar: collection dropdown, request tree or history, footer |
| `RequestWindow.tsx` | The request editor and response, the history entry view, or an empty state |
| `CollectionRunner.tsx` | Runs the requests of a collection or folder one after another |
| `CollectionCreate.tsx` | Dialog to create a collection in a new directory |
| `CollectionImport.tsx` | Dialog to open a Trufos collection or import one through a plugin importer |

The components are described in [UI Components]({% link documentation/ui-components/index.md %}).

## Monaco editors

Text bodies, scripts and responses are edited and shown in [Monaco](https://microsoft.github.io/monaco-editor/), set up in `src/renderer/lib/monaco/`:

- `models.ts` keeps one editor model per request for its text body and each script. These models are the only owner of that text: edits are sent to main as debounced (1 s) commands, and operations that need the text (sending, saving, switching request or collection, closing) flush them first. See [Main-Owned Collection State]({% link documentation/architecture/collection-state.md %}#drafts).
- `editor-content.ts` loads a request's text into its models through an IPC stream and refreshes them when the files change on disk, without overwriting what the user typed.
- `language.ts` and the providers add `{% raw %}{{variable}}{% endraw %}` support: semantic highlighting, completion of the available variables and their values on hover.
- `theme.ts` defines the editor themes; `config.ts` sets up the editor workers, which `tools/vite-plugin-monaco.mts` bundles.
- `SingleLineEditor.tsx` is a one-line Monaco editor, e.g. for the URL, so variables are highlighted there too.

Scripts get type information for the `trufos` API from `assets/trufos-scripting-api.d.ts`. That file is generated from `src/shim/scripting.ts` by the `generateAssets` hook in `forge.config.ts`; do not edit it.

## Services and hooks

- `services/event/renderer-event-service.ts`: the typed IPC client, see [Event Service]({% link documentation/services/event-service.md %}).
- `services/http/http-service.ts`: sends a request by ID and lets it be cancelled through an `AbortSignal`, see [HTTP Service]({% link documentation/services/http-service.md %}).
- `hooks/request/useRequestActions.ts`: `useSendRequest()` and `useSaveRequest()`, shared by the buttons, the hotkeys and the command palette.
- `hooks/hotKeys/`: every keyboard shortcut is defined once in `hotkeys.ts` and registered with `useHotkeys()`.
- `lib/ipc-stream.ts`: `IpcPushStream` reads bodies and scripts from main in chunks.

## Styling

The renderer uses Tailwind CSS v4 through its Vite plugin. The design tokens (colours, radius, fonts) and the theme variants are CSS custom properties in `src/renderer/styles/index.css`; there is no `tailwind.config.js`. UI primitives come from shadcn/ui on Radix UI, in `src/renderer/components/ui/`.

## Build

`src/renderer/vite.config.mts` configures React, Tailwind, the Monaco plugin and the aliases `@/` (`src/renderer`) and `shim`.

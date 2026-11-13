---
title: State Management
nav_order: 4
parent: Architecture
description: The Zustand stores of the renderer and how the collection store follows the collection owned by the main process.
---

# State Management

The renderer keeps its state in [Zustand](https://zustand.docs.pmnd.rs/) stores with the Immer middleware, in `src/renderer/state/`. The open collection itself is **not** owned by the renderer: the main process owns it, and the collection store holds a read-only replica plus purely visual state. [Main-Owned Collection State]({% link documentation/architecture/collection-state.md %}) explains the protocol between the two; this page covers the renderer side.

## Stores

| Store | File | Holds |
| --- | --- | --- |
| Collection store | `collectionStore.ts` | The replica of the open collection, plus selection, open folders, sort mode and the current script tab |
| `useResponseStore` | `responseStore.ts` | The latest response of each request, by request ID |
| `useHistoryStore` | `historyStore.ts` | The request history of the current collection and the selected entry |
| `useAppSettingsStore` | `appSettingsStore.ts` | The app settings (theme, TLS verification, MCP server) |
| `usePluginStore` | `pluginStore.ts` | The plugins and the contributions of the enabled ones |
| `useViewStore` | `viewStore.ts` | Which modals and views are open and what the sidebar shows |

### Collection store

Unlike the other stores, the collection store is not a global singleton. `CollectionStoreProvider` (`CollectionStoreProvider.tsx`) fetches the snapshot of the open collection from main and creates the store with `createCollectionStore()`, then provides it through React context. Components read it with `useCollectionStore(selector)` and get its actions with `useCollectionActions()`.

The store has two parts:

- **The model**: the collection with its variables and environments, the selected environment, the folders and requests by ID, the saved state of requests that have a draft, and the order of children (`childIds`). It mirrors the `CollectionModel` of a `CollectionState` (`collection-state.ts`) and is never changed directly.
- **UI state**: the selected request, open folders, multi-selection, sort mode and script tab.

Every action that changes the collection, e.g. `updateRequest()`, `renameItem()` or `moveItems()`, turns into a `CollectionCommand`. `CollectionState` applies it to its model right away (optimistically), sends it to main with `dispatch()`, and reconciles once main broadcasts the resulting patches. Each change of the model is copied into the store. The actions are listed with their doc comments in `interface/CollectionStateActions.ts`.

The text bodies and scripts are not part of the model. They live in the Monaco models of the request (`lib/monaco/models.ts`), see [Renderer Process]({% link documentation/architecture/renderer-process.md %}#monaco-editors).

The selected request, open folders, sort mode and script tab are restored when a collection is opened again. The store sends them to main 500 ms after the last change (`helper/collection-ui-state.ts`), and main keeps them with the open collection in `state.json`.

The provider also keeps the collection in sync with its files: when the window loses focus it sends the editor changes and asks main to write everything, and when it gets focus back it asks main to reload the collection if the files changed. Before the window closes, it flushes the editor changes and the UI state.

### Other stores

The other stores are created with `create()` and used as hooks. The history, plugin and app settings stores load their state from main once and take over what main pushes later (`history-changed`, `plugins-changed`). Changes to the app settings are saved through `saveAppSettings()` right away.

## Conventions

- **Actions**: `useActions()` (`helper/util.ts`) selects all functions of a store with shallow equality, so components that only need actions do not re-render on state changes, e.g. `const { addResponse } = useResponseActions()`.
- **Selectors**: stores export selectors such as `selectResponse` or `selectSidebarView`. Selectors must return stable references; derive new objects with `useMemo` or a dedicated hook such as `useCollectionTree()`.
- **Immer**: actions mutate a draft. `enableMapSet()` in `index.tsx` allows `Map` and `Set` in state.
- **Errors**: async actions show their errors as a toast themselves and resolve to `false` instead of rejecting.
- State that more than one component needs belongs in a store, not in component state.

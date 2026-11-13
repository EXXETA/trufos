---
title: Project Structure
nav_order: 3
parent: Contributing
description: How the Trufos repository is laid out, from the main and renderer processes to plugins and the end-to-end suite.
---

# Project Structure

Trufos is an Electron app built with Electron Forge and Vite, written in TypeScript. The repository is a Yarn workspace: the app lives in `src/`, and the bundled plugins in `plugins/` are workspaces of their own.

```
.
├── .github/                # CI workflows, issue templates, agent instructions and prompts
├── .vscode/                # VS Code settings (Prettier on save, MCP servers)
├── docs/
│   ├── architecture/       # architecture decision records, copied to this site
│   └── images/             # images used by README.md and CONTRIBUTING.md
├── e2e/                    # Playwright end-to-end suite that drives the packaged bundles
│   ├── fixtures/           # app launcher, echo server, test data
│   ├── helpers/            # shared locators and interactions
│   └── specs/              # the tests
├── examples/collection/    # an example collection in the current on-disk format
├── images/                 # app icons per platform (linux/, macos/, windows/)
├── plugins/                # bundled plugins, one Yarn workspace each
│   ├── __fixtures__/       # test plugin with every contribution type
│   ├── bruno/              # Bruno importer
│   ├── openapi/            # OpenAPI importer
│   └── postman/            # Postman importer
├── src/
│   ├── main/               # main process (Node.js)
│   ├── renderer/           # renderer process (React)
│   └── shim/               # code and types shared by both processes and by plugins
├── tools/                  # build helpers: Monaco Vite plugin, source fingerprint for e2e
├── AGENTS.md               # conventions for contributors and AI agents
├── components.json         # shadcn/ui configuration
├── eslint.config.mjs       # ESLint flat config
├── forge.config.ts         # Electron Forge: packaging, makers, fuses, publishing
├── index.html              # HTML entry point of the renderer
├── package.json            # scripts, dependencies, workspaces
├── tsconfig.base.json      # compiler options shared by all TypeScript projects
├── tsconfig.json           # TypeScript project for the build tooling
└── vitest.config.mts       # Vitest projects: main, renderer, shim, plugins
```

Generated directories are not listed: `node_modules/`, `.vite/` (bundles of `yarn start` and `yarn package`), `out/` (packaged app and installers) and `e2e/test-results/`.

## Main process: `src/main`

```
src/main/
├── __mocks__/          # Vitest mocks: electron, node:fs (memfs), node:process
├── collection-state/   # CollectionStateService, file watcher, persistence effects of commands
├── environment/        # variable resolution and system variables
├── error/              # InternalError
├── event/              # MainEventService (IPC handlers), stream-events, sendToRenderer
├── export/             # ExportService and the built-in ZIP exporter
├── filesystem/         # FileSystemService: temporary files, atomic writes
├── history/            # HistoryService: request history of the session
├── import/             # ImportService, routes imports to plugin importers
├── logging/            # Winston logger, receives renderer logs
├── mcp/                # MCP server: HTTP transport, access token, tools
├── network/
│   ├── authentication/ # Basic, Bearer, Digest, OAuth 1.0, OAuth 2.0
│   └── service/        # HttpService, BodyStore, dispatcher cache, error mapping
├── persistence/        # PersistenceService, info files and migrations, secrets, settings, state
├── plugin/             # PluginService, plugin host, list of bundled plugins
├── scripting/          # ScriptingService: pre-request and post-response scripts
├── shared/             # Initializable interface
├── util/               # semver, serial queue, fs helpers, size and time helpers
├── close-window.ts     # flushes pending changes before the window closes
├── main.ts             # entry point: starts the services and creates the window
├── menu.ts             # native application menu
├── preload.ts          # exposes IPC to the renderer through contextBridge
└── vite.config.mts     # Vite and Vitest configuration of main and preload
```

## Renderer process: `src/renderer`

```
src/renderer/
├── __mocks__/          # Vitest mocks, e.g. Monaco models
├── assets/             # SVG components, generated scripting API types for Monaco
├── components/
│   ├── commandPalette/ # command palette (cmdk)
│   ├── history/        # request history list and entry view
│   ├── icons/          # custom SVG icons
│   ├── mainWindow/     # request editor and response view
│   ├── shared/         # settings modals, header editor, inline rename, dialogs
│   ├── sidebar/        # collection dropdown, request tree, toolbars
│   └── ui/             # shadcn/ui components
├── contexts/           # ThemeContext
├── error/              # MainProcessError, showError()
├── hooks/              # hotkeys, send and save actions, body streaming
├── lib/                # Monaco setup and editor models, IPC stream, utils
├── logging/            # console wrapper that forwards logs to main
├── services/           # RendererEventService (IPC), HttpService
├── state/              # Zustand stores and the replica of the collection state
├── styles/             # Tailwind CSS v4 entry point and design tokens (index.css)
├── util/               # formatting and object helpers
├── view/               # top-level views: sidebar, request window, runner, import, create
├── App.tsx             # root component: layout, modals, event listeners
├── index.tsx           # entry point
└── vite.config.mts     # Vite and Vitest configuration of the renderer
```

## Shared code: `src/shim`

`src/shim` holds what both processes need: the data model (`objects/`), the normalized collection model with its commands (`collection-model/`), the IPC contract (`event-service.ts`), app settings, history and MCP types, errors, and the public plugin API (`plugin/`). Plugins may only import from `shim/plugin`.

## Configuration files

- **TypeScript**: every directory with its own runtime has its own `tsconfig.json` (`src/shim`, `src/main`, `src/renderer`, `plugins`, `e2e`), and the root one covers the build tooling. `yarn typecheck` checks all of them.
- **Styling**: Tailwind CSS v4 is configured in CSS (`src/renderer/styles/index.css`) and runs as a Vite plugin. There is no `tailwind.config.js` or `postcss.config.js`.
- **Formatting and linting**: `.prettierrc` and `eslint.config.mjs`, see [Coding Style]({% link documentation/development/coding-style.md %}).
- **Build**: `forge.config.ts` and the `vite.config.mts` of each process, see [Building and Packaging]({% link documentation/development/building-packaging.md %}).

The [Architecture]({% link documentation/architecture/index.md %}) section explains how these parts work together.

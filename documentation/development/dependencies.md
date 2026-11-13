---
title: Key Dependencies
nav_order: 3
parent: Development
description: The libraries Trufos is built on and what each is used for.
---

# Key Dependencies

This page lists the most important dependencies and what Trufos uses them for. `package.json` of the app and of each plugin in `plugins/` has the complete list.

## Framework and build

| Package | Used for |
| --- | --- |
| `electron` | The desktop runtime: main and renderer processes, native APIs, `safeStorage` |
| `@electron-forge/*` | Building, packaging and publishing: the Vite and fuses plugins, makers for Squirrel (Windows), DMG (macOS), deb and ZIP (Linux), the GitHub publisher |
| `vite`, `@vitejs/plugin-react` | Bundling main, preload and renderer, dev server with hot reload |
| `typescript` | The language of the whole code base |
| `react`, `react-dom` | The UI (React 19) |
| `update-electron-app` | Checks GitHub Releases for updates and installs them (Windows only, see [Building and Packaging]({% link documentation/development/building-packaging.md %}#releases)) |
| `electron-squirrel-startup` | Handles the Squirrel install events on Windows |

## UI and styling

| Package | Used for |
| --- | --- |
| `tailwindcss`, `@tailwindcss/vite` | Styling with Tailwind CSS v4, configured in CSS |
| `@radix-ui/react-*` | Accessible primitives under the shadcn/ui components |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Variants and conditional class names (`cn()`) |
| `lucide-react` | Icons |
| `monaco-editor`, `@monaco-editor/react` | Editors for bodies, scripts, URLs and responses |
| `cmdk` | The command palette |
| `@dnd-kit/core`, `@dnd-kit/sortable` | Drag and drop in the request tree |
| `react-resizable-panels` | Resizable sidebar and request panes |
| `sonner` | Toast notifications |
| `xml-formatter` | Formatting XML in the editors |

## State and validation

| Package | Used for |
| --- | --- |
| `zustand` | Stores in the renderer |
| `immer` | Immutable updates in stores, the collection model and its patches (`produceWithPatches`, `applyPatches`) |
| `zod` | Schemas for info files, settings, commands, plugin manifests and MCP tools; validation at runtime boundaries |

## Main process

| Package | Used for |
| --- | --- |
| `undici` | Sending HTTP requests |
| `openid-client` | OAuth 2.0 flows and OpenID Connect discovery |
| `template-replace-stream` | Replacing variables in streamed request bodies |
| `mime-types` | File extensions for downloaded response bodies |
| `@zip.js/zip.js` | ZIP export, optionally encrypted with AES-256 |
| `@modelcontextprotocol/server`, `@modelcontextprotocol/node` | The MCP server, see [MCP Server]({% link documentation/architecture/mcp-server.md %}) |
| `winston` | Logging |

## Plugins

Heavy importer dependencies live in the plugin workspaces, not in the app, so they are only loaded when a plugin is used:

| Plugin | Package |
| --- | --- |
| `plugins/postman` | `postman-collection` |
| `plugins/bruno` | `@usebruno/lang` |
| `plugins/openapi` | `@readme/openapi-parser` |

## Testing and tooling

| Package | Used for |
| --- | --- |
| `vitest`, `@vitest/coverage-v8` | Unit and component tests, coverage |
| `jsdom` | Browser environment for renderer tests |
| `@testing-library/react`, `@testing-library/user-event`, `@testing-library/dom` | Component tests |
| `memfs` | In-memory file system for main-process tests |
| `@playwright/test` | End-to-end tests against the Electron app |
| `eslint`, `@typescript-eslint/*`, `eslint-plugin-import-x` | Linting |
| `prettier`, `prettier-plugin-tailwindcss` | Formatting, including the order of Tailwind classes |

## Adding a dependency

- Add it to the workspace that uses it: a plugin's own `package.json` if only that plugin needs it.
- Commit the updated `yarn.lock`. CI installs with `yarn install --immutable` and fails if the lockfile is out of date.

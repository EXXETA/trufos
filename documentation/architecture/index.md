---
title: Architecture
nav_order: 4
parent: Contributing
has_children: true
description: How Trufos is built, from the Electron processes to collection state, persistence, plugins and the MCP server.
---

# Architecture

Trufos is an [Electron](https://www.electronjs.org/) app. The **main process** runs Node.js: it owns the open collection, reads and writes the files, sends HTTP requests and runs scripts. The **renderer process** runs the React UI and reaches everything else through IPC. Code both need lives in `src/shim`.

The pages in this section:

1. [Main Process]({% link documentation/architecture/main-process.md %}): startup, services and the application lifecycle.
2. [Renderer Process]({% link documentation/architecture/renderer-process.md %}): the React app, its views and the Monaco editors.
3. [IPC Communication]({% link documentation/architecture/ipc-communication.md %}): the typed contract between the processes, events and streams.
4. [State Management]({% link documentation/architecture/state-management.md %}): the Zustand stores of the renderer.
5. [Main-Owned Collection State]({% link documentation/architecture/collection-state.md %}): how main owns the open collection and the renderer follows it.
6. [Persistence]({% link documentation/architecture/persistence.md %}): the files of a collection and of the app.
7. [Collection Schema Versioning]({% link documentation/architecture/schema-versioning.md %}): versions and migrations of info files.
8. [Rename Behavior]({% link documentation/architecture/rename-behaviour.md %}): what renaming does on disk.
9. [Error Handling]({% link documentation/architecture/error-handling.md %}): how errors cross the IPC boundary and reach the user.
10. [Logging]({% link documentation/architecture/logging.md %}): log files and how renderer logs reach them.
11. [Plugin Architecture]({% link documentation/architecture/plugins.md %}): the plugin API, manifests and permissions.
12. [MCP Server]({% link documentation/architecture/mcp-server.md %}): the server that lets AI agents use the open collection.

Pages 5, 7, 8, 11 and 12 are copied from `docs/architecture/` on `main`. Each names its source file at the top; change that file first and copy it here afterwards.

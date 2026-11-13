---
title: Services
nav_order: 5
parent: Contributing
has_children: true
description: The main-process services of Trufos and their renderer counterparts.
---

# Services

Most of Trufos' logic lives in singleton services in the main process (`src/main/`), each with a static `instance`. The renderer reaches them through IPC; where it needs more than the IPC call, it has a thin counterpart in `src/renderer/services/`. [Main Process]({% link documentation/architecture/main-process.md %}) lists all services.

The pages in this section:

1. [Variable Resolver]({% link documentation/services/variable-resolver.md %}): resolves variables, inherited authorization and headers from a collection model.
2. [Event Service]({% link documentation/services/event-service.md %}): the two ends of the IPC contract.
3. [HTTP Service]({% link documentation/services/http-service.md %}): prepares, sends and records requests and stores their response bodies.
4. [Persistence Service]({% link documentation/services/persistence-service.md %}): reads and writes the files of collections.
5. [Settings and State]({% link documentation/services/settings-service.md %}): the user's preferences and the state of the app.

The `CollectionStateService`, which owns the open collection, is described in [Main-Owned Collection State]({% link documentation/architecture/collection-state.md %}), the `PluginService` in [Plugin Architecture]({% link documentation/architecture/plugins.md %}) and the `McpServerService` in [MCP Server]({% link documentation/architecture/mcp-server.md %}).

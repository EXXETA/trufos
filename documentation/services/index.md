---
title: Core Services
nav_order: 7
has_children: true
---

# Core Services

Trufos is built upon a set of core services that manage different aspects of its functionality. These services are primarily located in the main process (`src/main/`) but may have counterparts or wrappers in the renderer process (`src/renderer/services/`) for easier access via IPC.

This section provides detailed information on these key services:

1.  **[Environment Service]({% link documentation/services/environment-service.md %})**: Manages collections, environments, and variables.
2.  **[Event Service]({% link documentation/services/event-service.md %})**: Handles Inter-Process Communication (IPC) between the main and renderer processes.
3.  **[HTTP Service]({% link documentation/services/http-service.md %})**: Responsible for making HTTP requests.
4.  **[Persistence Service]({% link documentation/services/persistence-service.md %})**: Manages storing and retrieving data from the file system.
5.  **[Settings Service]({% link documentation/services/settings-service.md %})**: Handles application-level settings.

Understanding the roles and interactions of these services is fundamental to understanding how Trufos operates. 
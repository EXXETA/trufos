---
title: Architecture Overview
nav_order: 4
has_children: true
---

# Architecture Overview

Trufos is an [Electron](https://www.electronjs.org/) application, which means it's fundamentally composed of two types of processes: a **Main process** and one or more **Renderer processes**. This architecture allows Trufos to leverage web technologies (HTML, CSS, JavaScript/TypeScript via React) for its user interface while still being able to access native operating system capabilities.

This section delves into the key architectural aspects of Trufos:

1.  **[Main Process]({% link documentation/architecture/main-process.md %})**: The backbone of the application, managing windows, application lifecycle, and native interactions.
2.  **[Renderer Process]({% link documentation/architecture/renderer-process.md %})**: Responsible for rendering the user interface within browser windows.
3.  **[IPC Communication]({% link documentation/architecture/ipc-communication.md %})**: How the Main and Renderer processes communicate with each other.
4.  **[State Management]({% link documentation/architecture/state-management.md %})**: How application state is managed, primarily in the Renderer process.
5.  **[Persistence]({% link documentation/architecture/persistence.md %})**: How data like collections, requests, and settings are stored and retrieved.
6.  **[Error Handling]({% link documentation/architecture/error-handling.md %})**: Strategies for managing and displaying errors.
7.  **[Logging]({% link documentation/architecture/logging.md %})**: How application events and errors are logged for debugging.

Understanding these components is essential for developing and maintaining Trufos effectively. 
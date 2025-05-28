---
title: Development Practices
nav_order: 5
has_children: true
---

# Development Practices

This section outlines the key development practices, tools, and configurations used in the Trufos project. Adhering to these practices helps maintain code quality, consistency, and ease of collaboration.

## Core Technologies

*   **Electron**: Framework for building cross-platform desktop applications using web technologies.
*   **React**: JavaScript library for building user interfaces.
*   **TypeScript**: Typed superset of JavaScript that compiles to plain JavaScript.
*   **Vite**: Fast build tool and development server. Used for both main and renderer process bundling.
*   **Tailwind CSS**: Utility-first CSS framework for styling.
*   **ShadCN UI**: Collection of re-usable UI components built with Radix UI and Tailwind CSS.
*   **Zustand**: State management library for React.
*   **Winston**: Logging library for the main process.
*   **Vitest**: Test runner framework.

## Key Areas

*   **[Coding Style]({% link documentation/development/coding-style.md %})**: Guidelines on code formatting and linting using Prettier and ESLint.
*   **[Testing]({% link documentation/development/testing.md %})**: Information about the testing setup with Vitest.
*   **[Dependencies]({% link documentation/development/dependencies.md %})**: Overview of key project dependencies.
*   **[Building and Packaging]({% link documentation/development/building-packaging.md %})**: How the application is built and packaged using Electron Forge. 
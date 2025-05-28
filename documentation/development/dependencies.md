---
title: Key Dependencies
nav_order: 3
parent: Development Practices
---

# Key Dependencies

Trufos relies on a number of key libraries and frameworks. Understanding these dependencies is helpful for development. This is not an exhaustive list but covers the most significant ones.

## Core Framework & Build Tools

*   **`electron`**: The core framework for building cross-platform desktop applications using web technologies.
    *   _Role_: Provides the main and renderer process architecture, native APIs, and packaging capabilities.
*   **`@electron-forge/cli` & related plugins**: The build pipeline and toolchain for Electron applications.
    *   _Role_: Handles packaging, making distributables (DMG, Squirrel, ZIP), and integrating build tools like Vite.
    *   Plugins used: `plugin-vite`, `plugin-auto-unpack-natives`, `plugin-fuses`.
*   **`vite`**: A modern frontend build tool.
    *   _Role_: Bundles JavaScript/TypeScript for both main and renderer processes, provides a fast development server with HMR.
*   **`typescript`**: Typed superset of JavaScript.
    *   _Role_: Enhances code quality, maintainability, and developer experience.
*   **`react` & `react-dom`**: A JavaScript library for building user interfaces.
    *   _Role_: Powers the entire UI of the renderer process.

## UI & Styling

*   **`@monaco-editor/react` & `monaco-editor`**: The code editor component that powers Visual Studio Code.
    *   _Role_: Used for displaying and editing request/response bodies, with custom language features for template variables.
*   **`@radix-ui/*`**: A collection of unstyled, accessible UI primitives.
    *   _Role_: Foundation for many of the `shadcn/ui` components.
*   **`tailwindcss`**: A utility-first CSS framework.
    *   _Role_: Primary styling mechanism for the application. Configured in `tailwind.config.js`.
*   **`shadcn/ui` (implicitly, via `components.json` and `src/renderer/components/ui/`)**: A collection of re-usable UI components built using Radix UI and Tailwind CSS.
    *   _Role_: Provides a base set of styled and accessible components (Button, Input, Dialog, etc.).
*   **`lucide-react` & `react-icons`**: Icon libraries.
    *   _Role_: Provide icons used throughout the application.
*   **`class-variance-authority` (cva) & `clsx` & `tailwind-merge`**: Utilities for constructing dynamic and conditional class names, especially for Tailwind CSS.
    *   _Role_: Used heavily in `shadcn/ui` components and custom components for flexible styling.

## State Management

*   **`zustand`**: A small, fast, and scalable state-management solution for React.
    *   _Role_: Manages global application state in the renderer process (e.g., collections, responses, variables).
*   **`immer`**: A library for working with immutable state in a more convenient way.
    *   _Role_: Used as middleware with Zustand to allow "mutable" state updates in actions.

## Networking & Data Handling (Main Process)

*   **`undici`**: A fast, spec-compliant HTTP/1.1 client for Node.js.
    *   _Role_: Used by `HttpService` in the main process to make actual HTTP requests.
*   **`postman-collection`**: A Node.js module to work with Postman Collection Format v1.0/v2.0/v2.1.
    *   _Role_: Used by `PostmanImporter` to parse and import Postman collections.
*   **`template-replace-stream`**: A Node.js stream transform for replacing template strings.
    *   _Role_: Used by `EnvironmentService` to substitute variables (e.g., `{{variable}}`) in request bodies.
*   **`tmp`**: A temporary file and directory creator for Node.js.
    *   _Role_: Used by `FileSystemService` and `HttpService` for managing temporary files, e.g., for response bodies.
*   **`mime-types`**: Utility to look up MIME types by extension and vice versa.
    *   _Role_: Likely used for determining content types of files.

## Logging (Main Process)

*   **`winston`**: A multi-transport async logging library for Node.js.
    *   _Role_: Handles structured logging in the main process, including file and console output.

## Testing

*   **`vitest`**: A Vite-native test runner.
    *   _Role_: Used for unit and integration tests in both main and renderer processes.
*   **`jsdom`**: A JavaScript implementation of many web standards, for use with Node.js.
    *   _Role_: Provides a simulated browser environment for renderer process tests.
*   **`@testing-library/react`**: Utilities for testing React components.
    *   _Role_: Used for writing tests for UI components in the renderer process.
*   **`memfs`**: An in-memory file system.
    *   _Role_: Used in main process tests to mock file system operations.

## Development Utilities

*   **`eslint` & plugins**: Code linter.
*   **`prettier`**: Code formatter.
*   **`electron-devtools-installer`**: Helper to install Chrome DevTools extensions in Electron.

This list provides a good overview of the technological landscape of Trufos. For a complete list, refer to the `dependencies` and `devDependencies` sections in `package.json`. 
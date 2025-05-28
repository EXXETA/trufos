---
title: Project Structure
nav_order: 3
---

# Project Structure

Understanding the project's directory and file layout is crucial for effective development. Trufos follows a structure common to Electron applications built with Vite and TypeScript.

```
.
├── .electron-forge/    # Electron Forge intermediate build files
├── .github/            # GitHub specific files (workflows, issue templates)
├── .idea/              # IntelliJ IDEA project settings (ignored by Git)
├── .vscode/            # VS Code specific settings
├── docs/               # Developer documentation (this site)
├── images/             # Application icons and other static image assets
├── node_modules/       # Project dependencies
├── out/                # Build output from Electron Forge
│   ├── make/           # Packaged application (installers, executables)
│   └── ...
├── src/                # Source code
│   ├── main/           # Electron Main Process
│   │   ├── __mocks__/  # Mocks for main process testing
│   │   ├── environment/ # Environment and variable management
│   │   ├── error/      # Main process specific error types
│   │   ├── event/      # IPC event handling (MainEventService, stream-events)
│   │   ├── filesystem/ # Filesystem utilities
│   │   ├── import/     # Data import logic (e.g., Postman collections)
│   │   ├── logging/    # Winston logger setup for main process
│   │   ├── network/    # HTTP client service
│   │   ├── persistence/# Data persistence services (collections, settings)
│   │   ├── shared/     # Code shared within the main process
│   │   ├── util/       # Utility functions for the main process
│   │   ├── main.ts     # Main process entry point
│   │   ├── menu.ts     # Application menu setup (not currently used in UI)
│   │   ├── preload.ts  # Electron preload script
│   │   └── vite.config.ts # Vite configuration for the main process
│   ├── renderer/       # Electron Renderer Process (UI - React, TypeScript, Vite)
│   │   ├── __mocks__/  # Mocks for renderer process testing
│   │   ├── assets/     # Static assets like SVGs used in the UI
│   │   ├── components/ # React UI components
│   │   │   ├── icons/
│   │   │   ├── mainWindow/
│   │   │   ├── shared/
│   │   │   ├── sidebar/
│   │   │   └── ui/     # ShadCN UI components
│   │   ├── error/      # Renderer process specific error types
│   │   ├── lib/        # Utility libraries for the renderer (Monaco, IPC stream)
│   │   ├── logging/    # Console wrapper for logging from renderer
│   │   ├── services/   # Renderer-specific services (event, HTTP wrapper)
│   │   ├── state/      # Zustand state management stores
│   │   ├── styles/     # CSS and Tailwind styles
│   │   ├── util/       # Utility functions for the renderer process
│   │   ├── view/       # Top-level view components (Menubar, RequestWindow)
│   │   ├── App.tsx     # Root React component
│   │   ├── index.tsx   # Renderer process entry point
│   │   ├── preload.d.ts# Type definitions for preload script exposed on window
│   │   └── vite.config.ts # Vite configuration for the renderer process
│   └── shim/           # Shared data structures and types (TypeScript)
│       ├── event-service.ts # Interface for event services
│       ├── fs.ts       # Filesystem related types
│       ├── headers.ts  # HTTP header types
│       ├── logger.ts   # Logger related types
│       └── objects/    # Core data model objects (Collection, Request, Folder, etc.)
├── .eslintrc.json      # ESLint configuration (legacy, see eslint.config.mjs)
├── .gitignore          # Specifies intentionally untracked files
├── .nvmrc              # Specifies the Node.js version for the project
├── .prettierrc         # Prettier configuration
├── CODE_OF_CONDUCT.md  # Contributor Covenant Code of Conduct
├── components.json     # ShadCN UI configuration
├── CONTRIBUTING.md     # Guidelines for contributing
├── eslint.config.mjs   # ESLint configuration (flat config)
├── forge.config.ts     # Electron Forge configuration
├── forge.env.d.ts      # Type declarations for Electron Forge Vite plugin
├── index.html          # HTML entry point for the renderer process
├── LICENSE             # Project license (GPL-3.0-or-later)
├── package.json        # Project metadata, dependencies, and scripts
├── postcss.config.js   # PostCSS configuration (for Tailwind CSS)
├── README.md           # Project overview and user-facing information
└── tailwind.config.js  # Tailwind CSS configuration
```

## Key Directories

*   **`src/main`**: Contains all code that runs in Electron's main process. This includes application lifecycle management, native OS interactions, background tasks, and services that manage data, network requests, and inter-process communication.
*   **`src/renderer`**: Contains all code for the user interface, running in Electron's renderer process. This is a React application built with Vite and TypeScript, responsible for displaying information and interacting with the user.
*   **`src/shim`**: Holds TypeScript interfaces, types, and enums that are shared between the main and renderer processes. This ensures type safety across IPC boundaries. These are typically data transfer objects (DTOs) or shared constants.
*   **`out/`**: This directory is generated by Electron Forge during the build process. It contains packaged versions of the application for different platforms.
*   **Root Configuration Files**: Files like `package.json`, `forge.config.ts`, `vite.config.ts` (in `src/main` and `src/renderer`), `tailwind.config.js`, and ESLint/Prettier configurations define how the project is built, structured, and maintained.

A deeper dive into the architectural components within these directories can be found in the [Architecture]({% link documentation/architecture/index.md %}) section. 
---
title: Building & Packaging
nav_order: 4
parent: Development Practices
---

# Building and Packaging

Trufos uses [Electron Forge](https://www.electronforge.io/) as its primary tool for building, packaging, and distributing the application. The configuration for Electron Forge is located in `forge.config.ts`.

## Configuration (`forge.config.ts`)

This file defines how Electron Forge handles the build and packaging process.

Key sections:

1.  **`packagerConfig`**: Options passed to `electron-packager`.
    *   `asar: true`: Packages the application source code into an [ASAR archive](https://www.electronjs.org/docs/latest/tutorial/asar-archives) for potentially faster load times and to hide source code.
    *   `icon: './images/icon'`: Specifies the path to the application icon (without extension, Electron Forge handles platform-specific formats like `.icns` or `.ico`).
    *   `osxSign` & `osxNotarize`: macOS specific signing and notarization settings. These are conditionally configured based on environment variables (`APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`), enabling code signing and notarization if credentials are provided.

2.  **`rebuildConfig`**: Configuration for rebuilding native Node modules (empty in this case, but important if native dependencies are used).

3.  **`makers`**: Defines the types of distributables to create.
    *   `MakerSquirrel`: Creates a Windows installer (`Setup.exe`) using Squirrel.Windows.
    *   `MakerZIP`: Creates a `.zip` archive, configured here for Linux (`['linux']`).
    *   `MakerDMG`: Creates a `.dmg` disk image for macOS.

4.  **`plugins`**:
    *   **`AutoUnpackNativesPlugin`**: Automatically unpacks native Node modules from the ASAR archive, which is often necessary for them to function correctly.
    *   **`VitePlugin`**: Integrates Vite for building the main and renderer process code.
        *   **`build` array**: Configures Vite builds for non-renderer code.
            *   Main process entry: `src/main/main.ts` with config `src/main/vite.config.ts`.
            *   Preload script entry: `src/main/preload.ts` with config `src/main/vite.config.ts`.
        *   **`renderer` array**: Configures Vite builds for renderer process code.
            *   Named `main_window` with entry point implicitly handled by Vite via `index.html` and config `src/renderer/vite.config.ts`.
    *   **`FusesPlugin`**: Allows toggling certain Electron security features at package time. This configuration enhances security by:
        *   Disabling `RunAsNode`.
        *   Enabling cookie encryption.
        *   Disabling Node.js options environment variables and CLI inspect arguments.
        *   Enabling ASAR integrity validation and ensuring the app only loads from ASAR.

5.  **`publishers`**: Configures how and where to publish releases.
    *   `@electron-forge/publisher-github`: Configured to publish releases to GitHub under the `EXXETA/trufos` repository, marked as prereleases.

## Build Process Commands

Defined in `package.json`:

*   **`yarn package`**:
    *   Runs `electron-forge package`.
    *   Builds the application and packages it into a platform-specific runnable format (e.g., an `.app` bundle on macOS, an `exe` with associated files on Windows) in the `out/` directory. This is an unpackaged version, not an installer.

*   **`yarn run make`**:
    *   Runs `electron-forge make`.
    *   First, it performs the packaging step (like `yarn package`).
    *   Then, it uses the specified `makers` (MakerSquirrel, MakerZIP, MakerDMG) to create distributable installers/archives (e.g., `Setup.exe`, `.dmg`, `.zip`) in the `out/make/` directory.

*   **`yarn publish`**:
    *   Runs `electron-forge publish`.
    *   Builds, makes, and then publishes the application according to the `publishers` configuration (in this case, to GitHub Releases).

## How Vite is Used

The `VitePlugin` in `forge.config.ts` orchestrates the use of Vite:

1.  **Main Process & Preload Script**:
    *   Vite is configured in library mode for these entries (`src/main/main.ts`, `src/main/preload.ts`).
    *   The output is placed in `.vite/build/` (e.g., `.vite/build/main.js`, `.vite/build/preload.js`).
    *   Electron Forge then uses these built files when packaging the application.

2.  **Renderer Process**:
    *   Vite builds the React application (`src/renderer/`).
    *   The output (HTML, JS, CSS assets) is placed in `.vite/renderer/main_window_vite_renderer/`.
    *   Electron Forge includes these assets in the packaged application, and the main window loads the `index.html` from this location.

During development (`yarn start`), `electron-forge start` uses Vite's development server for HMR (Hot Module Replacement) for the renderer process and rebuilds main/preload scripts as needed. 
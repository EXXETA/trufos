---
title: Building & Packaging
nav_order: 4
parent: Development
description: How Electron Forge and Vite build, package and publish Trufos.
---

# Building and Packaging

Trufos is built, packaged and published with [Electron Forge](https://www.electronforge.io/), configured in `forge.config.ts`. Vite bundles the code.

## Commands

| Command | What it does |
| --- | --- |
| `yarn start` | `electron-forge start`: development build with the Vite dev server and hot reload |
| `yarn package` | `electron-forge package`: production bundles in `.vite/` and the runnable app in `out/`, no installer. The end-to-end suite needs it. |
| `yarn make` | `electron-forge make`: packages, then builds the installers into `out/make/` |
| `yarn publish` | `electron-forge release`: packages, makes the installers and uploads them to a GitHub release |

## Vite builds

The `VitePlugin` in `forge.config.ts` runs three builds:

| Entry | Config | Output |
| --- | --- | --- |
| `src/main/main.ts` (main) | `src/main/vite.config.mts` | `.vite/build/main.cjs` |
| `src/main/preload.ts` (preload) | `src/main/vite.config.mts` | `.vite/build/preload.cjs` |
| `index.html` (renderer `main_window`) | `src/renderer/vite.config.mts` | `.vite/renderer/main_window/` |

Main is built with source maps (inline in development) and without minification. The bundled plugins are dynamic imports, so each becomes a chunk of its own that is only loaded when the plugin is first used. The MCP server and its SDK are a separate chunk as well.

## Hooks

- **`generateAssets`** generates `src/renderer/assets/trufos-scripting-api.d.ts` from the `GlobalScriptingApi` interface in `src/shim/scripting.ts`. Monaco uses it to offer completion for the `trufos` API in scripts. It also takes a fingerprint of the sources.
- **`postPackage`** stores that fingerprint with the bundles, so the end-to-end suite can refuse bundles that are older than the sources (`tools/source-fingerprint.ts`).

## Packaging

`packagerConfig`:

- `asar: true`: the app is packaged into an [ASAR archive](https://www.electronjs.org/docs/latest/tutorial/asar-archives).
- Icons per platform from `images/macos/`, `images/windows/` and `images/linux/`. On Linux the executable is named `trufos`.
- **macOS signing**: with `APPLE_API_KEY`, `APPLE_API_KEY_ID` and `APPLE_API_ISSUER` set, the app is signed and notarized. Without them it is signed ad hoc, which is enough to run it locally.

The **fuses** (`FusesPlugin`) switch off Electron features the app does not need, at package time:

- `RunAsNode` off: the app cannot be started as plain Node.js.
- `EnableNodeOptionsEnvironmentVariable` and `EnableNodeCliInspectArguments` off: no `NODE_OPTIONS`, no inspector.
- `EnableCookieEncryption` on.
- `EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar` on: only the verified archive is loaded.

Because of these fuses, the end-to-end suite cannot test the packaged app; it runs against the bundles.

## Installers

| Maker | Platform | Output |
| --- | --- | --- |
| `MakerSquirrel` | Windows | `Setup.exe` (Squirrel.Windows), plus the `.nupkg` and `RELEASES` files the updater needs |
| `MakerDMG` | macOS | `.dmg` |
| `MakerDeb` | Linux | `.deb`, in the categories Utility and Development |
| `MakerZIP` | Linux | `.zip` |

## Releases

A push to the `release` branch runs `.github/workflows/release.yml`. On Linux and Windows runners, it runs the tests and `yarn publish`, which uploads the installers with `@electron-forge/publisher-github` to a GitHub release of `EXXETA/trufos`, marked as a prerelease. The workflow has no macOS runner; the `.dmg` files of a release are built separately.

On Windows, installed apps update themselves from these releases through `update-electron-app`, which checks every hour. macOS and Linux do not update themselves: `update-electron-app` does not support Linux, and on macOS it needs a `.zip` of the app, which `forge.config.ts` only builds for Linux.

On every push and pull request to `main`, `.github/workflows/ci.yml` checks formatting and types, runs the tests, runs the end-to-end suite on Linux, and packages the app if `yarn.lock` changed.

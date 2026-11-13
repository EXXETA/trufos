---
title: Getting Started
nav_order: 2
parent: Contributing
description: Set up a development environment for Trufos, run the app and its checks, and build installers.
---

# Getting Started

This page shows you how to set up Trufos for development, run it, run the checks a pull request has to pass, and build installers.

## Prerequisites

- **Node.js 24**, as set in `.nvmrc`. With a version manager such as [nvm](https://github.com/nvm-sh/nvm):

  ```bash
  nvm use
  ```

- **Yarn**: the repository ships Yarn 4 in `.yarn/releases/`, so you do not install it yourself. If you have never used Yarn on your machine, run `corepack enable` once. Do not use npm to install dependencies.
- **Git**.

## Installation

```bash
git clone https://github.com/EXXETA/trufos.git
cd trufos
yarn install
```

`yarn install` also installs the dependencies of the bundled plugins in `plugins/`, which are Yarn workspaces.

## Running in development mode

```bash
yarn start
```

This runs `electron-forge start`: the renderer is served by the Vite dev server with hot module replacement, and changes to `src/main` rebuild the main process. In development, the main process logs to the terminal at level `debug`.

Development uses the same user data directory as an installed Trufos, so it opens your real collections and settings. See [Logging]({% link documentation/architecture/logging.md %}) and [Persistence]({% link documentation/architecture/persistence.md %}) for where files are kept.

## Checks

Run these after every change. CI runs all of them on every pull request except `yarn lint`, so run that yourself.

| Command               | What it does                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `yarn test`           | Unit and component tests with Vitest (main, renderer, shim, plugins) |
| `yarn typecheck`      | Type-checks every TypeScript project. Vitest does not type-check.   |
| `yarn lint`           | ESLint                                                              |
| `yarn prettier-check` | Checks formatting; `yarn prettier` fixes it                         |
| `yarn e2e`            | Playwright end-to-end tests against the packaged bundles            |

The end-to-end suite needs `yarn package` first, see [Testing]({% link documentation/development/testing.md %}).

## Building installers

```bash
yarn make
```

This runs `electron-forge make` and writes the installers for your operating system to `out/make/`:

- **Windows**: `Setup.exe` (Squirrel installer)
- **macOS**: `.dmg`
- **Linux**: `.deb` and `.zip`

Without Apple credentials, the macOS build is signed ad hoc and not notarized. See [Building and Packaging]({% link documentation/development/building-packaging.md %}) for details.

## Next steps

- Read [Project Structure]({% link documentation/project-structure.md %}) to find your way around the code.
- Set up your editor as described in [Coding Style]({% link documentation/development/coding-style.md %}).
- Read `AGENTS.md` in the repository. Despite its name, it is the most complete list of the project's conventions, for people and AI agents alike.

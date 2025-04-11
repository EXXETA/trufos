---
title: Getting Started
nav_order: 2
---

# Getting Started

We're currently working on prebuilt binaries for Windows, macOS, and Linux. In the meantime, you can
[build the application yourself](#build-it-yourself).

## Build it yourself

Trufos is an open-source project, and you can build it yourself. As it is an [Electron] application,
it can run on Windows, macOS, and Linux without any issues. You will need [Node.js] version 22 and a
recent yarn version.

From inside the project directory, run:

1. Run `yarn install --frozen-lockfile` to install all dependencies
2. Run `yarn run make` to build the application for your platform
3. The built application will be in the `out/make` directory
    - Windows: a `Setup.exe` file
    - macOS: a `.dmg` file
    - Linux: currently a ZIP file (`.deb` file and Flatpak is planned)

---

[Node.js]: https://nodejs.org

[Electron]: https://www.electronjs.org/
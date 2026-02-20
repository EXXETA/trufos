---
title: Download
nav_order: 2
---

# Download

<div class="releases-container" id="releases-container">
    <p class="status">Loading latest release...</p>
</div>

## Build it yourself

Trufos is an open-source project, and you can build it yourself. As it is an [Electron] application,
it can run on Windows, macOS, and Linux without any issues. You will need [Node.js] version 24.

1. Clone the repository with `git clone`
2. Change to the cloned directory with `cd trufos`
3. Run `yarn install --immutable` to install all dependencies
4. Run `yarn run make` to build the application for your platform
5. The built application will be in the `out/make` directory
   - Windows: a `Setup.exe` file
   - macOS: a `.dmg` file
   - Linux: currently a ZIP file (`.deb` file and Flatpak is planned)

---

[Node.js]: https://nodejs.org
[Electron]: https://www.electronjs.org/

[![CI Pipeline](https://github.com/EXXETA/trufos/actions/workflows/ci.yml/badge.svg)](https://github.com/EXXETA/trufos/actions/workflows/ci.yml)
![GitHub contributors](https://img.shields.io/github/contributors/EXXETA/trufos)
[![Discord](https://img.shields.io/discord/1328262093903892530?logo=discord&label=Discord&cacheSeconds=60)](https://discord.gg/sb4nfdevpW)
![version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FEXXETA%2Ftrufos%2Frefs%2Fheads%2Fmain%2Fpackage.json&query=%24.version&label=version)

<h1 align="center">Trufos - The REST Utility, free and Open Source</h1>
<p align="center">
  A REST client that is both easy to use, efficient, and extendable.
</p>

As many REST clients exist in the ecosystem, Trufos aims to provide an out-of-the-box experience
that is fast, user-friendly, and customizable. Below is an overview of current and planned features:

| Feature                                       | Status         | Notes                                                    |
| --------------------------------------------- | -------------- | -------------------------------------------------------- |
| Offline usage (no registration / login)       | ✅ Implemented | Works fully offline; all data stored locally             |
| Handling of large request & response payloads | ✅ Implemented | Minimized data kept in memory                            |
| Version control-friendly collections          | ✅ Implemented | Collections stored as JSON for easy diff & collaboration |
| Authentication (JWT, OAuth 2.0, Basic)        | ✅ Implemented | Supports multiple auth flows including token refresh     |
| Scripting (custom request/response handling)  | 🛠 Planned     |                                                          |
| Plugin architecture / extensions              | 🛠 Planned     |                                                          |

**Current Development Status**: Trufos is still at an early stage of development. Be aware of this
when using Trufos under production conditions. If you would like to contribute to this project,
please check out our [Contributing Guidelines](./CONTRIBUTING.md).

![Screenshot nothing selected](docs/images/Screenshot-nothing-selected.png)

![Screenshot request and response with variable](docs/images/Screenshot-request-variable.png)

## Requirements

As Trufos is an Electron application, it can run on Windows, macOS, and Linux without any issues. If
you want to develop or build this software yourself, you will need Node.js version 22. We use **yarn**
and not NPM in this project as it can better handle peer dependencies. **Do not install dependencies with NPM!**

### Local Development

1. Clone this repository
2. Run `yarn install` to install all dependencies
3. Run `yarn start` to start the application in development mode

### Building the Application

1. Run `yarn install` to install all dependencies
2. Run `yarn run make` to build the application for your platform
3. The built application will be in the `out/make` directory
   - Windows: a `Setup.exe` file
   - macOS: a `.dmg` file
   - Linux: currently a ZIP file (`.deb` file is planned)

## Usage

Once Trufos is installed and launched, you can start adding endpoints, customizing them, and making
calls.

### Example Usage

Here’s a simple example of how to add and utilize an endpoint:

1. Click on "Create New Request".
2. Enter the URL.
3. Select the method (`GET`, `POST`, etc.).
4. Optionally, add headers and body content.
5. Click "Send Request" and review the response in the results area.

## FAQ

- Where can I find the saved Requests?
- The saved requests are in this folder:
  - Mac: `~/Library/Application\ Support/Trufos/default-collection`
  - Windows: `C:\Users\USERNAME\AppData\Roaming\Trufos\default-collection`

## Contributing

If you would like to contribute to this project, please check out our
[Contributing Guidelines](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md) before you
begin.

We welcome feedback, suggestions, and pull requests!

## Licence

Licensed under GPL v3.0.

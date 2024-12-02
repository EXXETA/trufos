[![CI Pipeline](https://github.com/EXXETA/rufus/actions/workflows/ci.yml/badge.svg)](https://github.com/EXXETA/rufus/actions/workflows/ci.yml)
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-0-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->
![Codecov](https://img.shields.io/codecov/c/github/EXXETA/rufus)
![Dynamic JSON Badge](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FEXXETA%2Frufus%2Frefs%2Fheads%2Fmain%2Fpackage.json&query=%24.version&label=version)

<h1 align="center">Trufos - The Rest Utility, free and Open Source</h1>
<p align="center">
  A REST client that is both easy to use, efficient, and extendable.
</p>

As many REST clients exist in the ecosystem, Trufos aims to provide an out-of-the-box experience that is fast, user-friendly, and customizable. Trufos intends to offer the following features:

- Offline usage: No registration or login required
- Smooth handling of large request and response objects
- Version control-friendly storage of requests and collections, facilitating easy collaboration
- Custom handling of HTTP requests and responses via script injection
- Support for various authentication methods, including JWT, OAuth, and basic authentication
- Extendable plugin architecture for additional features and integrations

**Current Development Status**: Trufos is still at an early stage of development. Be aware of this when using Trufos under production conditions. If you would like to contribute to this project, please check out our [Contributing Guidelines](./CONTRIBUTING.md).

## Screenshot

![img.png](docs/Screenshot.png)
## Requirements

As Trufos is an Electron application, it can run on Windows, macOS, and Linux without any issues. If you want to develop or build this software yourself, you will need Node.js version 22 or higher and NPM version 10 or higher.

## Usage

Once Trufos is installed and launched, you can start adding endpoints, customizing them, and making calls.


### Example Usage

Here’s a simple example of how to add and utilize an endpoint:

1. Click on "New Endpoint".
2. Enter the API URL.
3. Select the method (GET, POST, etc.).
4. Optionally, add headers and body content.
5. Click "Send Request" and review the response in the results area.

## FAQ

* Where can I find the saved Requests?
* The saved requests are in this folder:
  * Mac: ``~/Library/Application\ Support/Trufos/default-collection`` 
  * Windows: ``C:\Users\USERNAME\AppData\Roaming\Trufos\default-collection``


## Contributing

If you would like to contribute to this project, please check out our
[Contributing Guidelines](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md) before you begin.

We welcome feedback, suggestions, and pull requests!

## Licence

Licensed under GPL v3.0.

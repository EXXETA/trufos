[![CI Pipeline](https://github.com/EXXETA/rufus/actions/workflows/ci.yml/badge.svg)](https://github.com/EXXETA/rufus/actions/workflows/ci.yml)
![Codecov](https://img.shields.io/codecov/c/github/EXXETA/rufus)
![Dynamic JSON Badge](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FEXXETA%2Frufus%2Frefs%2Fheads%2Fmain%2Fpackage.json&query=%24.version&label=version)

<h1 align="center">Rufus</h1>
<p align="center">
  A rest client that is both easy to use, efficient and extendable
</p>

With many other existing rest clients in the ecosphere, Rufus intends to provide an out-of-the-box
experience that is both fast, easy to use and customizable.
Additionally, Rufus aims to provide the following features:

- Offline only, no registration or logins necessary
- Smooth handling of large request and response objects
- Version control friendly storage of requests and collections, allowing easy collaboration
- Custom handling of HTTP requests and responses via custom script injection

As of right now, Rufus is still in early development and is not yet ready for production use.
If you would like to contribute to this project, please check out our
[Contributing Guidelines](./CONTRIBUTING.md)

## Requirements

As Rufus is an electron application, it can be run on Windows, macOS and Linux without any issues.
If you want to develop or build this software yourself, you will need Node.js version 14 or higher
and NPM version 7 or higher.

## Installation

You can either download one of the provided binaries or you can build the software yourself
by cloning the repository and running `npm run make` after which the binary can be found inside
the `out/make/` directory.

## Usage

Once Rufus is installed and launched, you can begin by adding endpoints, customizing them
and calling them.

TODO: Add screenshots here

## FAQ

TBD

## Contributing

If you would like to contribute to this project, please check out our
[Contributing Guidelines](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md)
before beginning to do so.
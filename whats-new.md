---
title: What's new in 1.0
nav_order: 5
description: The features and changes that came to Trufos between 0.8.0 and the 1.0.0 release.
---

# What's new in 1.0
{: .no_toc }

Trufos 1.0.0 is the first stable release. This page summarises what changed since 0.8.0. For the full list of changes, see the [releases on GitHub](https://github.com/EXXETA/trufos/releases).

1. TOC
{:toc}

## Collections and the sidebar

- Rename folders and requests directly in the sidebar instead of in a dialog.
- Select several items at once and apply actions to all of them.
- Discard unsaved changes to a request.
- When the collection files change outside the app, for example after a `git pull`, Trufos reloads the collection.
- Collections load faster, and Trufos keeps its window size, position and application state between restarts.
- Export a collection as a ZIP archive.

## Requests and responses

- Cancel a request that is still running.
- Download a response body as a file.
- New body type "none" for requests without a body.
- Headers can be inherited from folders and collections. New headers are enabled by default, and invalid headers are flagged.
- Syntax highlighting in the URL field.
- When sending fails, Trufos shows what went wrong.
- Request and response history.
- Collection Runner: send all requests of a collection or folder in one go.

## Authorization and TLS

- New authorization types: Digest and OAuth 1.0.
- Authorization can be inherited from folders and collections.
- OAuth 2.0 endpoints are filled in from the issuer URL.
- TLS certificates are verified, and the private key for mTLS client certificates is optional.

## Import and export

- Import OpenAPI and Bruno collections, in addition to Postman.
- Importers ship as bundled plugins.

## App

- Light and dark themes, and a settings page.
- Command palette and keyboard shortcuts for common actions.
- A Trufos application menu replaces the default Electron menu.
- New app icon.
- A Plugins page.
- Built-in MCP server, so AI clients can work with your collections.

## For contributors

- End-to-end tests with Playwright.
- Collection state is owned by the main process.
- Plugin architecture with a versioned plugin API.

See [Contributing]({% link documentation/index.md %}) to get started.

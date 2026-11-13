---
title: Persistence
nav_order: 6
parent: Architecture
description: How Trufos stores collections, drafts, secrets and its own settings on disk.
---

# Persistence

Trufos keeps collections as plain files in a directory of the user's choice, so they can be versioned with Git. The app's own data lives in Electron's user data directory. All files are read and written by the main process.

## The files of a collection

Every collection, folder and request is a directory with a JSON **info file**. Child directories are named after the sanitized title of the folder or request.

```
my-collection/
├── collection.json          # title, variables, environments, headers, client certificate, …
├── order.json               # order of the children (IDs)
├── .gitignore               # written by Trufos, see below
├── .secrets.bin             # secrets of the collection, encrypted (not versioned)
├── users/                   # a folder
│   ├── folder.json
│   ├── order.json
│   └── get-user/            # a request
│       ├── request.json     # method, URL, headers, body type, authorization, …
│       ├── request-body.txt # text body, if any
│       ├── pre-request-script.js
│       ├── post-response-script.js
│       └── .draft/          # unsaved changes (not versioned)
│           ├── request.json
│           └── request-body.txt
└── create-user/
    └── request.json
```

`examples/collection/` in the app repository is an example in the current format.

- **Info files** (`collection.json`, `folder.json`, `request.json`) carry a `version`. Older versions are migrated when they are read, and a file newer than the app understands is refused, see [Collection Schema Versioning]({% link documentation/architecture/schema-versioning.md %}).
- **Order**: `order.json` lists the IDs of the children of a collection or folder in the order they are shown.
- **Bodies and scripts** are separate files: `request-body.txt`, `pre-request-script.js` and `post-response-script.js`. They are not part of the info file, so the collection model does not hold them, and they are always streamed, never read completely into memory to be sent. A file body is not copied; `request.json` stores the path of the file.
- **Drafts**: editing a request turns it into a draft. Its changes are written to `.draft/` inside the request directory, which holds a complete copy (info file, body, scripts). Saving moves the draft files over the saved ones; discarding deletes `.draft/`. A request that was never saved only has a draft.
- **Secrets**: the values of secret variables (of the collection and its environments) and every authorization are removed from the info file and stored in `.secrets.bin` next to it, encrypted with Electron's `safeStorage` (`SecretService`). The key is kept by the operating system, so secrets cannot be read on another machine. When the info file is read, the secrets are merged back and validated with its schema.
- **`.gitignore`**: Trufos makes sure the `.gitignore` of a collection contains `.draft`, `.secrets.bin` and `.*.tmp`. It only adds missing lines and keeps the user's own.

## Writing files

- Text bodies, scripts, JSON files and secrets are written **atomically** with `FileSystemService.replaceFile()`: the content goes to a temporary dotfile next to the target (`.<name>.<uuid>.tmp`), which then replaces it. Readers never see a half-written file.
- All other temporary files, e.g. response bodies, go through `FileSystemService.temporaryFile()` in the system's temporary directory and are deleted when the app quits.
- All writes of the open collection run on one queue in the `CollectionStateService`. The info file of an edited request is written 2 seconds after its last edit, or earlier before it is sent, saved or the app closes. See [Main-Owned Collection State]({% link documentation/architecture/collection-state.md %}).
- Main watches the directory of the open collection and reloads it when its files change outside the app, e.g. after `git pull`.

The `PersistenceService` that implements this is described in [Persistence Service]({% link documentation/services/persistence-service.md %}). What renaming does on disk is in [Rename Behavior]({% link documentation/architecture/rename-behaviour.md %}).

## Data of the app

The app's own files are in the user data directory (`app.getPath('userData')`):

| Platform | Directory |
| --- | --- |
| Windows | `%APPDATA%\Trufos` |
| macOS | `~/Library/Application Support/Trufos` |
| Linux | `~/.config/Trufos` |

| File | Written by | Content |
| --- | --- | --- |
| `settings.json` | `SettingsService` | The user's preferences: theme, TLS verification, MCP server |
| `state.json` | `StateService` | The open collections with their selected environment and UI state, and the current collection |
| `plugins.json` | `PluginService` | Which plugins are enabled |
| `mcp-token.bin` | `McpAccessToken` | The access token of the MCP server, encrypted |
| `default-collection/` | `PersistenceService` | The collection that is always open; created on first start |
| `logs/` (Windows, Linux) | logger | Log files; on macOS they are in `~/Library/Logs/Trufos`, see [Logging]({% link documentation/architecture/logging.md %}) |

The JSON files are handled by `JsonFile` (`src/main/persistence/json-file.ts`): each has a version and migrators, its content is validated with a Zod schema whenever it is read or changed, kept immutable in memory, and written atomically one change at a time. See [Settings and State]({% link documentation/services/settings-service.md %}).

## What is not persisted

- **The request history** and **response bodies** exist for the session only. Bodies are kept in temporary files encrypted with a key that only exists in memory (`BodyStore`), so a file left behind by a crash can never be read.
- **Panel sizes** are kept by react-resizable-panels in the renderer's `localStorage`.

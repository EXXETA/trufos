---
title: Persistence Service
nav_order: 4
parent: Services
description: The PersistenceService that reads and writes the files of collections, folders and requests.
---

# Persistence Service

**Location**: `src/main/persistence/service/persistence-service.ts`

The `PersistenceService` reads and writes the files of collections, folders and requests in the layout described in [Persistence]({% link documentation/architecture/persistence.md %}). It does not own any state of the open collection: the `CollectionStateService` decides what to write and when, and calls this service from its queue. Objects passed to it are never modified, as they may be frozen.

## Paths

Directory names follow the titles, which can change, so the service keeps a map from object ID to directory (`idToPathMap`). A new folder or request gets a directory named after its sanitized title (`sanitizeTitle()` in `src/shim/string.ts`). If that name is taken, by a known object or by a directory that happens to exist on disk, a number is appended.

## Reading

| Method | Purpose |
| --- | --- |
| `loadCollection(dirPath, recursive?)` | Reads a collection with its children; the `CollectionStateService` normalizes it into its model |
| `walkCollection(dirPath)` | Reads the saved state of a collection (no drafts) into a snapshot with lazy streams for the files, without registering any paths; used by the ZIP export |
| `loadCollectionBase(dirPath)` | Reads only the ID, title and directory, e.g. for the list of recent collections |
| `loadSavedRequest(id, parentId)` | Reads the saved state of a request, ignoring its draft |
| `openRequestFiles(request)` | Opens the text body and reads the scripts of a request before it is sent |
| `loadTextBodyOfRequest(request)`, `loadScript(request, type)` | Streams of the text body and a script, from the draft if there is one |

Reading an info file (`readInfoFile()`) parses the JSON, migrates it to the latest version (`migrateInfoFile()`), merges the secrets from `.secrets.bin` and validates the result with the schema of the latest version. See [Collection Schema Versioning]({% link documentation/architecture/schema-versioning.md %}).

## Writing

| Method | Purpose |
| --- | --- |
| `createCollection(dirPath, title)` | Creates a collection in an empty directory, with its `.gitignore` |
| `createDefaultCollectionIfNotExists()` | Creates the default collection in the user data directory on first start |
| `saveCollection(collection, recursive?)`, `saveCollectionInfo(info)`, `saveFolder(folder)` | Write info files |
| `saveRequestInfo(request)` | Writes the info file of a request, into `.draft/` if it is a draft |
| `saveOrder(parentId, childIds)` | Writes `order.json` of a collection or folder |
| `createDraft(request)` | Creates `.draft/` with a copy of the saved body and scripts |
| `writeTextBody(request, text)`, `saveScript(request, type, script)` | Write the text body or a script of the draft |
| `saveChanges(request)` | Moves the draft files over the saved ones and removes `.draft/` |
| `discardChanges(request)` | Deletes `.draft/`; a request that was never saved is deleted completely |
| `rename(node, title)` | Renames a folder or request and its directory, see [Rename Behavior]({% link documentation/architecture/rename-behaviour.md %}) |
| `move(id, newParentId)` | Moves a directory into another parent |
| `copyRequestFiles(source, copy)` | Copies the body and scripts of a request |
| `deleteNode(id)` | Deletes a folder or request with everything below it |

Saving an info file splits off the secrets (`extractSecrets()`) and writes them encrypted to `.secrets.bin` with the `SecretService`; if there are none, the file is removed. Text bodies, scripts, JSON and secrets are written atomically with `FileSystemService.replaceFile()`.

## Changes outside the app

- `isAppOwnedPath(path)` tells whether a file is only written by the app: drafts, secrets and temporary files, i.e. what the `.gitignore` of a collection excludes. The file watcher ignores these.
- `isContentFile(path)` tells whether a file is a text body or a script. Changes to these cannot change the collection model.
- `requestsOfContentFiles(paths)` maps changed content files to the IDs of their requests, so the renderer can refresh its editors.

## Tests

The tests (`persistence-service.test.ts` and others next to it) run against an in-memory file system: `node:fs` and `node:fs/promises` are mocked with [memfs](https://github.com/streamich/memfs) in `src/main/__mocks__/`. See [Testing]({% link documentation/development/testing.md %}).

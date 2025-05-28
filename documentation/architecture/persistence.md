---
title: Persistence
nav_order: 5
parent: Architecture Overview
---

# Persistence

Trufos persists data to the file system to ensure user work is saved across sessions and to facilitate version control. The persistence layer is primarily managed by services in the main process.

## Core Persistence Services

1.  **`PersistenceService` (`src/main/persistence/service/persistence-service.ts`)**:
    *   **Role**: The central service for all file system operations related to collections, folders, and requests.
    *   **Storage Strategy**:
        *   Each Trufos object (Collection, Folder, Request) generally corresponds to a directory on the file system.
        *   Metadata for each object is stored in a JSON file within its directory (e.g., `collection.json`, `folder.json`, `request.json`).
        *   Text-based request bodies are stored in separate files (e.g., `request-body.txt`).
    *   **Key Operations**:
        *   **Loading**:
            *   `loadCollection(dirPath, recursive?)`: Loads a collection from a given directory. Can load recursively (all children) or just the collection's metadata.
            *   `loadFolder(parentId, dirPath)`: Loads a folder.
            *   `loadRequest(parentId, dirPath)`: Loads a request.
            *   `loadTextBodyOfRequest(request, encoding?)`: Streams the text body of a request.
        *   **Saving**:
            *   `saveCollection(collection)`: Saves collection metadata.
            *   `saveFolder(folder)`: Saves folder metadata.
            *   `saveRequest(request, textBody?)`: Saves request metadata and optionally its text body. Handles draft versions by prefixing filenames with `~`.
            *   `saveCollectionRecursive(collection)`: Saves an entire collection and all its children.
        *   **Draft Management**:
            *   `saveChanges(request)`: Promotes a draft request's files (metadata and body) to become the primary files, deleting the draft versions.
            *   `discardChanges(request)`: Deletes draft files, reverting to the last saved non-draft state.
        *   **File/Directory Management**:
            *   `createDefaultCollectionIfNotExists()`: Ensures a default collection exists for new users.
            *   `createCollection(dirPath, title)`: Creates a new, empty collection structure.
            *   `rename(object, newTitle)`: Renames an object and its corresponding directory.
            *   `delete(object)`: Deletes an object and its directory, including all children recursively.
            *   `moveChild(child, oldParent, newParent)`: Moves an object's directory between parent directories.
    *   **Path Mapping**: Maintains an internal `idToPathMap` to track the file system path for each object ID, which is crucial for locating objects when their titles (and thus directory names) change.
    *   **Directory Naming**: Directory names are derived from sanitized object titles (lowercase, hyphenated, special characters removed). Handles name collisions by appending numbers (e.g., `my-request`, `my-request-2`).
    *   **`.gitignore`**: Creates a `.gitignore` file in collection directories to exclude draft files (`~request.json`) from version control.

2.  **`SettingsService` (`src/main/persistence/service/settings-service.ts`)**:
    *   **Role**: Manages application-wide settings that are not specific to a single collection.
    *   **Storage**: Settings are stored in a single JSON file: `USER_DATA_DIR/settings.json`.
        *   The `USER_DATA_DIR` path is platform-dependent (e.g., `~/Library/Application Support/Trufos` on macOS, `C:\Users\USERNAME\AppData\Roaming\Trufos` on Windows).
    *   **Key Settings**:
        *   `currentCollectionIndex`: Index into the `collections` array.
        *   `collections`: An array of directory paths to all known collections.
    *   **Operations**:
        *   `init()`: Loads settings from the file or creates default settings if the file doesn't exist.
        *   `settings` (getter): Provides read-only access to current settings.
        *   `setSettings(settings)`: Updates settings and writes them to the file.
        *   `modifiableSettings` (getter): Returns a deep clone of settings for modification.
    *   **Default Collection Path**: `USER_DATA_DIR/default-collection`.

## Info File Format and Migration

*   **Info Files**: JSON files (`collection.json`, `folder.json`, `request.json`) store the metadata for Trufos objects.
*   **Versioning**: Each info file contains a `version` field (e.g., `"version": "1.1.0"`), based on `SemVer` (`src/main/util/semver.ts`).
*   **Latest Schema**: Defined in `src/main/persistence/service/info-files/latest.ts`, which re-exports from the latest versioned file (e.g., `v1-1-0.ts`).
*   **Migration (`src/main/persistence/service/info-files/migrators.ts`)**:
    *   When an info file is loaded, its version is checked against the application's latest supported schema version (`LATEST_VERSION`).
    *   If the file's version is older, `migrateInfoFile` is called.
    *   This function iteratively applies migrators (defined in files like `v1-0-1.ts`, `v1-1-0.ts`) to upgrade the info file schema step-by-step until it matches the latest version.
    *   Each migrator (`AbstractInfoFileMigrator`) defines a `fromVersion` and a `migrate` function.
    *   Example changes in migrations:
        *   `v1.0.0` -> `v1.0.1`: Added `id` property (random UUID).
        *   `v1.0.1` -> `v1.1.0`: Added `environments` property to collections.

## Request Body Storage

*   **Text Bodies**:
    *   Stored in `request-body.txt` within the request's directory.
    *   Draft text bodies are stored in `~request-body.txt`.
    *   The `RequestBodyType.TEXT` in `request.json` indicates a text body. `mimeType` is also stored.
*   **File Bodies**:
    *   The `RequestBodyType.FILE` in `request.json` indicates a file body.
    *   `filePath` stores the absolute path to the user-selected file. `mimeType` may also be stored.
    *   Trufos does **not** copy the file into its own storage; it references the original file path.

## Data Integrity and Collaboration

*   Storing data in separate files and directories, with metadata in JSON, makes collections relatively version-control friendly (e.g., with Git).
*   The `.gitignore` helps avoid committing transient draft files.
*   The ID-based path mapping helps maintain references even if titles/directory names change, though moving files outside of Trufos could break these links.

This persistence strategy aims for a balance between human-readable/editable files, version control compatibility, and application performance. 
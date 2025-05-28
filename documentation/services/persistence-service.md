---
title: Persistence Service
nav_order: 4
parent: Core Services
---

# Persistence Service

**Location**: `src/main/persistence/service/persistence-service.ts`

The `PersistenceService` is a cornerstone of Trufos's main process, responsible for all interactions with the file system concerning the storage and retrieval of collections, folders, and requests.

## Core Responsibilities

*   **Data Storage Model**:
    *   Each Collection, Folder, and Request is generally represented by a directory on the disk.
    *   Metadata for these objects is stored in a JSON file within their respective directories (e.g., `collection.json`, `folder.json`, `request.json`).
    *   Request bodies (text-based) are stored in separate files (e.g., `request-body.txt`).
*   **CRUD Operations**:
    *   Creating new collections, folders, and requests on disk.
    *   Reading object metadata and content from files.
    *   Updating object metadata and content.
    *   Deleting objects and their associated directories/files.
*   **Directory and File Naming**:
    *   Derives directory names from sanitized object titles (lowercase, hyphenated, special characters removed via `sanitizeTitle`).
    *   Handles potential name collisions by appending sequential numbers (e.g., `my-folder`, `my-folder-2`).
*   **Draft Management**:
    *   Supports a "draft" state for requests. Draft metadata is saved in files prefixed with `~` (e.g., `~request.json`, `~request-body.txt`).
    *   `saveChanges(request)`: Promotes draft files to become the main files.
    *   `discardChanges(request)`: Deletes draft files, reverting to the last non-draft state.
*   **Schema Migration**:
    *   When loading info files, checks their `version` property.
    *   If an older version is detected, it uses `migrateInfoFile` (from `src/main/persistence/service/info-files/migrators.ts`) to upgrade the data structure to the latest schema before parsing.
*   **Path Management**:
    *   Maintains an internal `idToPathMap` (a `Map<string, string>`) to associate object IDs with their directory paths. This is crucial because directory names can change if an object's title changes.
    *   `getOrCreateDirPath(object)`: Retrieves the path for an object or generates a new, unique path if it's a new object.
*   **Default Collection**:
    *   `createDefaultCollectionIfNotExists()`: Ensures that a default collection (defined in `src/main/persistence/service/default-collection.ts`) is created for new users in the application's user data directory.

## Key Methods

*   **Loading Data**:
    *   `loadCollection(dirPath, recursive?)`: Loads collection metadata. If `recursive` is true (default), it also loads all child folders and requests by traversing the directory structure.
    *   `loadFolder(parentId, dirPath)`: Loads folder metadata and recursively its children.
    *   `loadRequest(parentId, dirPath)`: Loads request metadata, checking for draft versions.
    *   `loadTextBodyOfRequest(request, encoding?)`: Returns a `ReadableStream` for a request's text body (draft or main).
*   **Saving Data**:
    *   `saveCollectionRecursive(collection)`: Saves an entire collection tree to disk.
    *   `saveCollection(collection)`: Saves only the collection's `collection.json`.
    *   `saveFolder(folder)`: Saves the folder's `folder.json`.
    *   `saveRequest(request, textBody?)`: Saves the request's `request.json` (and `~request.json` if draft) and optionally its text body file.
*   **Modifying Structure**:
    *   `rename(object, newTitle)`: Renames an object and its corresponding directory. Updates `idToPathMap`.
    *   `delete(object)`: Deletes an object's directory and all its contents recursively. Updates `idToPathMap`.
    *   `moveChild(child, oldParent, newParent)`: Moves a child's directory from one parent's directory to another.
*   **Creating Collections**:
    *   `createCollection(dirPath, title)`: Creates a new collection directory, `collection.json`, and a `.gitignore` file (to ignore draft files).

## Info File Handling

*   **`toInfoFile(object)` (`src/main/persistence/service/info-files/latest.ts`)**: Converts an in-memory Trufos object (Collection, Folder, Request) into a plain JSON object suitable for storing in an info file. It omits properties not meant for persistence (e.g., `children` arrays from collections/folders, `parentId` from requests).
*   **`from<Type>InfoFile(...)` functions (`src/main/persistence/service/info-files/latest.ts`)**: Convert plain JSON objects read from info files back into typed Trufos objects, re-adding necessary runtime properties (like `type`, `parentId`, `children` arrays which are reconstructed during recursive loading).
*   **Reading Info Files**: The `readInfoFile` private method handles reading the JSON, parsing it, and triggering schema migration via `migrateInfoFile` if needed.

## File System Interaction

*   Uses Node.js `fs/promises` module for asynchronous file operations (e.g., `readFile`, `writeFile`, `mkdir`, `rm`, `rename`).
*   Uses `node:fs.createReadStream` for streaming file content (e.g., request bodies).
*   Utility `exists(filePath)` (from `src/main/util/fs-util.ts`) checks for file/directory existence.

The `PersistenceService` is central to Trufos's ability to manage user data persistently and in a way that is somewhat human-readable and version-control friendly. 
# Rename Behavior

The `PersistenceService.rename()` method updates both the logical (title) and physical (directory) representation of a folder or request.

Behavior details:

- The directory containing the `<type>.json` info file is renamed to match the sanitized new title (via `sanitizeTitle`).
- If the sanitized title does not change the directory name (e.g. only whitespace differences), the directory is left in place but the title inside the info file is still updated.
- A conflict (target directory already exists) is resolved with the same logic used for new items
- For folders the path map for all descendants is updated recursively so future path resolutions remain valid.
- The info file (`collection.json`, `folder.json`, `request.json` or draft variant) is rewritten to persist the new title. Draft files are not modified unless they are the active representation (requests with `draft: true`).

Edge cases:

- Secrets files and body files remain in place; only the directory container changes.

This guarantees that UI renames are reflected on disk and preserved across reloads.

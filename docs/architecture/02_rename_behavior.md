# Rename Behavior

Renaming is the `rename` command (see `03_main_owned_collection_state.md`). Main applies it to its model and persists it with `PersistenceService.rename()`, which updates both the logical (title) and physical (directory) representation of a folder or request.

Behavior details:

- The directory containing the `<type>.json` info file is renamed to match the sanitized new title (via `sanitizeTitle`).
- If the sanitized title does not change the directory name (e.g. only whitespace differences), the directory is left in place but the title inside the info file is still updated.
- A conflict (target directory already exists) is resolved with the same logic used for new items
- The path map entries of the renamed object and all its descendants are updated by replacing their path prefix, so future path resolutions remain valid.
- Folders: `folder.json` is rewritten to persist the new title.
- Requests: only the `title` field is patched into `request.json` and, if the request has a draft, into `.draft/request.json`. All other unsaved draft changes stay in the draft and are not written to the saved state. In the model, the title of the saved state of a draft request is updated as well.

Collections are not renamed through `rename`. The `renameCollection` command updates the title of the collection held by main and saves `collection.json`; the collection directory keeps its name.

Edge cases:

- Secrets files and body files remain in place; only the directory container changes.

This guarantees that UI renames are reflected on disk and preserved across reloads.

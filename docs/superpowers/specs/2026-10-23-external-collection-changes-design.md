# Reloading the Collection After Changes Outside the App

Issue: [#1073](https://github.com/EXXETA/trufos/issues/1073) (prerequisite for the git plugin,
[#865](https://github.com/EXXETA/trufos/issues/865))

## Problem

Main owns the open collection in memory (`03_main_owned_collection_state.md`) and has no file
watcher. When the files of the collection change outside the app (a branch switch, a pull, an
editor), the app keeps showing the old state and later writes it over the new files. The git
plugin changes the files of the open collection by design, so this has to work before it.

## Decisions

- **Triggers:** focus of the window and an explicit reload. No file watcher: it would need the
  same reload logic plus filtering of the app's own writes, emulated recursive watching on Linux
  and a policy for changes that arrive mid-edit. A watcher can be added later as one more caller
  of `reloadIfChanged()`.
- **Read failures** (e.g. merge conflict markers in an info file): keep the in-memory model, show
  the error, retry on the next focus or reload. Edits keep saving as today, so editing a request
  whose file is broken overwrites it with the app's version.

## Design

### Triggers

`CollectionStoreProvider` drives the reload, because only the renderer can flush the editors:

- **blur:** `flushModelEdits()`, then the new IPC `flushCollection()`
  (`CollectionStateService.flush()`). While the user is in another app, disk and memory match, so
  nothing the app writes later can clobber an external change.
- **focus:** the new IPC `reloadCollectionIfChanged()`, then the editor refresh below. A failure
  is shown with `showError()`.
- **explicit:** an entry "Reload from Disk" in the native Collection menu sends
  `MainProcessEvent.ReloadCollection`; the renderer flushes the editors and calls the new IPC
  `reloadCollection()`, which always reloads and broadcasts. The native menu is used instead of the
  collection dropdown, whose scroll height is fixed to its three header entries. The git plugin
  calls `CollectionStateService.reload()` from main after it ran git.

Main's queue keeps the order: the flushed editor edits, the flush and the reload check run one
after another.

### Main

`CollectionStateService.loadModel()` is split into:

- `readModel(dirPath)`: loads and normalizes the collection, the selected environment and the
  saved state of drafts, without side effects.
- installing a model: makes it current, clears the dirty requests and broadcasts a snapshot, as
  `loadModel()` does today.

`loadModel()` keeps its behaviour on top of the two. New public methods, each one queue task:

- `reloadIfChanged(): Promise<boolean>` writes the dirty requests, reads the model and compares it
  with the current one with `util.isDeepStrictEqual`, the version set equal. If they are equal,
  nothing happens; otherwise the read model is installed. Returns whether it reloaded.
- `reload(): Promise<void>` writes the dirty requests, reads and installs the model.

If reading fails, the current model stays and the error is thrown to the caller.

### Editors

Text bodies and scripts are not part of the model, so a changed body file does not produce a
snapshot. After a reload on focus or from the menu, the renderer refreshes the editors of the
selected request (only it has editor models) with `refreshModelContent()`: the content is replaced
only if it differs from disk and the model did not change while it was read and has no pending
edits, so nothing typed is lost and the undo history stays when nothing changed. A reload started
by main (the git plugin) does not refresh the editors yet; that is part of the plugin's command
flow.

## Testing

- `CollectionStateService`: unchanged disk does not broadcast; after the common commands and a
  flush, `reloadIfChanged()` does not broadcast (catches `undefined` vs. missing fields); an
  external change to an info file, a new folder and a deleted request each broadcast one snapshot;
  an unreadable info file keeps the model and throws.
- Renderer: blur flushes the editors before the collection; focus reloads; an editor whose file
  changed is reloaded, one with pending edits is not.
- e2e: a spec renames a request in its info file from the test, blurs and focuses the window and
  expects the new name in the sidebar. Written, run by the developer or CI.

## Documentation

A section "Changes outside the app" in `docs/architecture/03_main_owned_collection_state.md`.

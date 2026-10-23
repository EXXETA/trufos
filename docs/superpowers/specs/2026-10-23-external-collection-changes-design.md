# Reloading the Collection After Changes Outside the App

Issue: [#1073](https://github.com/EXXETA/trufos/issues/1073) (prerequisite for the git plugin,
[#865](https://github.com/EXXETA/trufos/issues/865))

## Problem

Main owns the open collection in memory (`03_main_owned_collection_state.md`) and has no file
watcher. When the files of the collection change outside the app (a branch switch, a pull, an
editor), the app keeps showing the old state and later writes it over the new files. The git
plugin changes the files of the open collection by design, so this has to work before it.

## Decisions

- **Triggers:** a file watcher in main, with the focus of the window and an explicit reload as
  fallbacks. A first version used only focus and the menu; it was extended with the watcher, as in
  VS Code, because it also catches changes while the window has focus (e.g. by the git plugin),
  tells which text bodies and scripts changed instead of reading the selected one on every focus,
  and Node 24 (Electron 45) watches recursively on Linux with one inotify watch per directory
  instead of polling. The app's own writes need no filtering beyond the ignored files: they read
  back as the same model. No new dependency (`@parcel/watcher`) is needed.
- **Changes mid-edit:** a dirty request is written before the comparison, so an edit made in the
  app wins over a change of the same request outside it. No conflict dialog.
- **Read failures** (e.g. merge conflict markers in an info file): keep the in-memory model, show
  the error, retry on the next focus or reload. Edits keep saving as today, so editing a request
  whose file is broken overwrites it with the app's version.

## Design

### Watcher

The responsibilities are split by layer:

- Persistence owns the file layout. `isAppOwnedPath()`, a module function of
  `persistence-service.ts`, matches the lines Trufos writes into the `.gitignore` of a collection
  (`GIT_IGNORE_LINES`: `.draft`, `.secrets.bin`, `.*.tmp`). The principle is to watch exactly what
  git versions; a test makes sure every line is a pattern the matcher supports. Every edit makes a
  request a draft first, so editing writes only into the ignored `.draft/`. `isContentFile()` and
  `PersistenceService.requestsOfContentFiles()` share one constant of the text body and script file
  names; the latter builds a directory-to-ID map once per batch.
- `CollectionWatcher` (`src/main/collection-state/collection-watcher.ts`) is the mechanism only:
  `fs.watch(dirPath, { recursive: true, persistent: false })`, an injected ignore rule, and a
  300 ms debounce after which the changes are reported together as `FileChanges`: the paths the
  platform named, and `unnamed` if any change came without a file name. A flag instead of an empty
  list, as a batch can mix named and unnamed changes. Watching another directory drops the pending
  changes, so a report always belongs to the watched collection.
- `CollectionStateService` owns the watcher and points it at every collection it installs, as it
  is the one place that knows when another collection becomes the open one. Its private
  `filesChanged()` runs `reloadIfChanged()` unless only text bodies and scripts changed and no
  change was unnamed, and emits `request-files-changed` with the saved requests whose text body or
  script changed, forwarded as `MainProcessEvent.RequestFilesChanged`. Both are handled and logged
  separately, so a failed reload does not keep the changed bodies from being announced, and no
  rejection reaches the watcher, which does not wait for the handler. Saving or copying a
  request writes these files too, so the renderer gets its own changes back and finds them equal;
  this is accepted.
- `FileSystemService` is unchanged. A generic watch there has no second user, and recognising own
  writes in `replaceFile()` would miss the renames, directory creations and deletions of
  `PersistenceService`, so the model comparison would still be needed.

A watcher failure is logged; the fallbacks below remain. When the git plugin runs git, its host
should call `reloadIfChanged()` right afterwards, so its command finishes with the collection
already up to date instead of after the debounce.

### Fallback triggers

`CollectionStoreProvider` drives them, because only the renderer can flush the editors:

- **blur:** `flushModelEdits()`, then the IPC `flushCollection()`.
- **focus:** the store action `checkForChanges()`: the IPC `reloadCollectionIfChanged()`, then the
  editors of the selected request are refreshed in any case, as main cannot tell whether a text body
  or script changed. A failure is shown through `reported()`; a focus handler in main could only
  log it. While the watcher runs, focus and a watcher report may refresh the same editor, which is
  harmless as an equal content changes nothing.
- **explicit:** an entry "Reload from Disk" in the native Collection menu sends
  `MainProcessEvent.ReloadCollection`; the store action `reloadFromDisk()` does the same as
  `checkForChanges()` with the IPC `reloadCollection()`, which always reloads and broadcasts. The native menu is used instead of the collection dropdown, whose scroll height
  is fixed to its three header entries.

### Main

`CollectionStateService.loadModel()` is split into:

- `readModel(dirPath)`: loads and normalizes the collection, the selected environment and the
  saved state of drafts, without side effects.
- installing a model: makes it current, clears the dirty requests and broadcasts a snapshot, as
  `loadModel()` does today.

`loadModel()` keeps its behaviour on top of the two. New public methods, each one queue task:

- `reloadIfChanged(): Promise<void>` writes the dirty requests, reads the model and compares it
  with the current one with `util.isDeepStrictEqual`, leaving out the version and the modification
  times. If they are equal, nothing happens; otherwise the read model is installed.
- `reload(): Promise<void>` writes the dirty requests, reads and installs the model.

If reading fails, the current model stays and the error is thrown to the caller.

### Editors

Text bodies and scripts are not part of the model. On `RequestFilesChanged` for the selected request
(only it has editor models), on focus and after "Reload from Disk", the renderer refreshes its editors with
`refreshModelContent()`: the content is replaced only if it differs from disk and the model did not
change while it was read and has no pending edits, so nothing typed is lost and the undo history
stays when nothing changed.

## Testing

- `CollectionStateService`: unchanged disk does not broadcast; after the common commands and a
  flush, `reloadIfChanged()` does not broadcast (catches `undefined` vs. missing fields); an
  external change to an info file, a new folder and a deleted request each broadcast one snapshot;
  an unreadable info file keeps the model and throws.
- Renderer: blur flushes the editors before the collection; focus checks for changes and refreshes
  the editors of the selected request even if main reloaded nothing; an editor whose file changed is
  reloaded, one with pending edits is not.
- `CollectionWatcher`: on memfs, changes are reported together after the debounce; an unnamed
  change is reported with the named ones and only once; the ignore rule is applied; switching the directory drops pending changes; a failing or impossible watch is only
  logged.
- `createGitIgnoreMatcher()`: drafts, secrets and temporary files at any depth, literal dots, and that
  every line of `GIT_IGNORE_LINES` is supported.
- `CollectionStateService` with a mocked watcher: it follows the open collection, ignores the
  app-owned files, reloads after changes and after an unnamed change, also in a batch with a text
  body, does not read the collection if only text bodies and scripts changed, announces their
  requests even if the reload fails, and leaves out requests that are not part of the open
  collection.
- e2e: specs rename a request in its info file and expect the new name in the sidebar, without a
  focus change (watcher), after a focus event and through the menu. Written, run by the developer or
  CI.

## Documentation

A section "Changes outside the app" in `docs/architecture/03_main_owned_collection_state.md`.

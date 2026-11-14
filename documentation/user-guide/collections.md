---
title: Collections and Requests
parent: User Guide
nav_order: 2
description: Create and open collections, organise requests in folders, rename, select, reorder, save and discard changes, and work with collection files that change on disk.
---

# Collections and Requests
{: .no_toc }

A **collection** is a folder on your disk that holds requests, folders of requests, variables and environments. Trufos saves everything as plain JSON files, so you can keep a collection in a Git repository and share it with your team.

1. TOC
{:toc}

## Create, open and close collections

The collection dropdown at the top of the sidebar shows the current collection. Open it to switch to another collection; each one is listed with its folder on disk.

{% include screenshot.html name="user-guide/collections-dropdown" alt="The collection dropdown with the New Collection, Import Collection and Run Collection actions and a list of open collections" width=1600 height=1050 %}

- **New Collection** creates a collection. Pick an empty folder (or a folder that does not exist yet), enter a name and click **Create Collection**.
- **Import Collection** opens a collection that is already on your disk, for example one you cloned from Git: select the **Trufos** tab, pick the folder that contains the `collection.json` file and click **Open Collection**. The other tabs import collections from other tools, see [Import and Export]({% link documentation/user-guide/import-export.md %}).

Trufos remembers the open collections and reopens the last one on the next start.

To rename or close a collection, click the **Collection settings** icon (the gear above the request list) and open the **General** tab. There you can also copy the path of the collection folder. Closing a collection only removes it from the list; its files stay on your disk. The Default Collection is always open and cannot be closed.

## Add requests and folders

Use the icons above the request list:

- **Add new request** adds a request at the top level of the collection. The shortcut is <kbd>Ctrl</kbd>+<kbd>N</kbd> (<kbd>Cmd</kbd>+<kbd>N</kbd> on macOS).
- **Add new folder** adds a folder at the top level.

To add a request or folder inside a folder, open the folder's **⋮** menu and choose **Add Request** or **Add Folder**. A new row appears in the list: type the name and press <kbd>Enter</kbd>, or press <kbd>Escape</kbd> to cancel.

Each row has a **⋮** menu that appears when you hover over it:

| Item    | Menu entries                                                                  |
| ------- | ----------------------------------------------------------------------------- |
| Request | Rename Request, Copy Request, Delete Request                                  |
| Folder  | Add Request, Add Folder, Rename Folder, Copy Folder, Folder Settings, Delete Folder |

**Copy** creates a copy of the request or folder. In **Folder Settings** you set an [authorization]({% link documentation/user-guide/authorization.md %}) and [headers]({% link documentation/user-guide/requests.md %}#headers) that the requests in the folder can inherit.

## Rename

Choose **Rename Request** or **Rename Folder** in the row's menu. The name turns into a text field in place: press <kbd>Enter</kbd> to keep the new name or <kbd>Escape</kbd> to cancel.

## Select several items

Select several requests and folders to copy or delete them in one go:

| To                                | Do this                                                                    |
| --------------------------------- | -------------------------------------------------------------------------- |
| Add or remove a single item       | <kbd>Ctrl</kbd>+click (<kbd>Cmd</kbd>+click on macOS)                      |
| Select a range                    | Click the first item, then <kbd>Shift</kbd>+click the last one             |
| Add a range to the selection      | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+click (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+click) |
| Clear the selection               | <kbd>Escape</kbd>, or click outside the request list                      |

While items are selected, a bar above the list shows how many there are, with buttons to **duplicate** or **delete** them all. Trufos asks for confirmation before it deletes them.

{% include screenshot.html name="user-guide/collections-multi-select" alt="Three selected requests in the sidebar and the bar above the list with the clear, duplicate and delete buttons" width=1600 height=1050 %}

## Reorder and sort

Drag a request or folder up or down to move it. To move it into or out of a folder, also drag it to the right or to the left: the indentation while you drag shows where it will land. If you drag one of several selected items, all of them move together.

The sort button at the left of the toolbar switches between these orders:

- **Manual order**: the order you set by dragging. Only in this mode can you drag items.
- **A → Z** and **Z → A**: by name.
- **Recently modified** and **Oldest modified**: by the time of the last change.

To move between requests with the keyboard, press <kbd>Ctrl</kbd>+<kbd>Page Up</kbd> and <kbd>Ctrl</kbd>+<kbd>Page Down</kbd> (<kbd>Cmd</kbd> on macOS).

## Save and discard changes

When you change a request, Trufos keeps the change as a **draft**. The saved version of the request stays as it was until you save, so a draft never shows up in Git. Drafts are kept on disk and survive a restart.

The two icons next to the URL field become active while a request has a draft:

- **Save request** (or <kbd>Ctrl</kbd>+<kbd>S</kbd> / <kbd>Cmd</kbd>+<kbd>S</kbd>) makes the draft the saved version.
- **Discard changes** throws the draft away and brings back the saved version. A new request that you have never saved is removed.

You can send a request without saving it; Trufos sends the draft.

## Changes outside Trufos

Trufos watches the folder of the open collection. When its files change outside the app, for example after `git pull`, after switching branches or when you edit a file in another editor, Trufos reloads the collection on its own. Bodies and scripts that are open in the editor are updated as well. Trufos also checks for changes when its window gets the focus again.

To reload by hand, choose **Collection** › **Reload from Disk** in the menu bar.

## What Trufos writes to disk

A collection folder contains:

| File or folder                    | Contents                                                                   | Commit to Git? |
| --------------------------------- | -------------------------------------------------------------------------- | -------------- |
| `collection.json`                 | Name, variables, environments, authorization and headers of the collection | Yes            |
| One folder per folder and request | `folder.json` or `request.json`, plus the request body and scripts as separate files | Yes  |
| `order.json`                      | The manual order of the items in a folder                                 | Yes            |
| `.draft/` in a request folder     | Unsaved changes of the request                                             | No             |
| `.secrets.bin` files              | Secret variables and credentials, encrypted for your user account          | No             |
| `.gitignore`                      | Keeps drafts and secrets out of Git                                        | Yes            |

Trufos creates the `.gitignore` itself and only adds lines to it, so you can add your own. Because secrets are encrypted for your user account on your computer, team members who clone the collection have to enter their own credentials.

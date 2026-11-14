---
title: Keyboard Shortcuts
parent: User Guide
nav_order: 10
description: All keyboard shortcuts of Trufos and the command palette for jumping to requests, switching environments and running actions.
---

# Keyboard Shortcuts
{: .no_toc }

On macOS, use <kbd>Cmd</kbd> wherever this page says <kbd>Ctrl</kbd>.

1. TOC
{:toc}

## Command palette

Press <kbd>Ctrl</kbd>+<kbd>K</kbd> to open the command palette. Type to search, move with the arrow keys and press <kbd>Enter</kbd> to choose.

{% include screenshot.html name="user-guide/command-palette" alt="The command palette with the search term book, listing the five matching requests of the Bookshop API collection" width=1600 height=1050 %}

The palette has four tabs; switch between them with <kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd>, or with <kbd>→</kbd> and <kbd>←</kbd>:

| Tab              | Lists |
| ---------------- | ----- |
| **All**          | Everything below |
| **Requests**     | The requests of the open collection, grouped by folder. Choose one to open it |
| **Environments** | The [environments]({% link documentation/user-guide/variables.md %}#environments) of the collection; the selected one is marked **active**. Choose one to select it |
| **Actions**      | Send request, Save request, New request, Discard changes, New folder, Switch environment, Collection settings and Settings |

## Shortcuts

### Requests

| Shortcut                                 | Action |
| ---------------------------------------- | ------ |
| <kbd>Ctrl</kbd>+<kbd>Enter</kbd>         | Send the request |
| <kbd>Ctrl</kbd>+<kbd>S</kbd>             | Save the request |
| <kbd>Ctrl</kbd>+<kbd>N</kbd>             | New request |
| <kbd>Ctrl</kbd>+<kbd>1</kbd>             | **Body** tab |
| <kbd>Ctrl</kbd>+<kbd>2</kbd>             | **Parameters** tab |
| <kbd>Ctrl</kbd>+<kbd>3</kbd>             | **Headers** tab |
| <kbd>Ctrl</kbd>+<kbd>4</kbd>             | **Auth** tab |
| <kbd>Ctrl</kbd>+<kbd>5</kbd>             | **Scripts** tab |
| <kbd>Ctrl</kbd>+<kbd>6</kbd>             | **Response Body** tab |
| <kbd>Ctrl</kbd>+<kbd>7</kbd>             | Response **Headers** tab |

### Sidebar

| Shortcut                                 | Action |
| ---------------------------------------- | ------ |
| <kbd>Ctrl</kbd>+<kbd>Page Up</kbd>       | Previous request |
| <kbd>Ctrl</kbd>+<kbd>Page Down</kbd>     | Next request |
| <kbd>Ctrl</kbd>+click                    | Add an item to the selection or remove it |
| <kbd>Shift</kbd>+click                   | Select a range |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+click   | Add a range to the selection |
| <kbd>Escape</kbd>                        | Clear the selection |

See [Select several items]({% link documentation/user-guide/collections.md %}#select-several-items) for what you can do with a selection.

### App

| Shortcut                                    | Action |
| ------------------------------------------- | ------ |
| <kbd>Ctrl</kbd>+<kbd>K</kbd>                | Command palette |
| <kbd>Ctrl</kbd>+<kbd>,</kbd>                | [Settings]({% link documentation/user-guide/settings.md %}) |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>,</kbd> | Collection settings |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> | [Request history]({% link documentation/user-guide/history-and-runner.md %}#request-history) |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> | [Collection Runner]({% link documentation/user-guide/history-and-runner.md %}#collection-runner) |

In the editors for the URL, bodies and scripts, the usual editor shortcuts work, for example <kbd>Ctrl</kbd>+<kbd>F</kbd> to find, <kbd>Ctrl</kbd>+<kbd>Z</kbd> to undo and <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> (<kbd>Shift</kbd>+<kbd>Option</kbd>+<kbd>F</kbd> on macOS) to format.

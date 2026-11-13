---
title: Core UI Elements
nav_order: 1
parent: UI Components
description: The primitives in src/renderer/components/ui that the rest of the UI is built from.
---

# Core UI Elements

The primitives in `src/renderer/components/ui/` are the building blocks of every screen. Most are [shadcn/ui](https://ui.shadcn.com/) components on [Radix UI](https://www.radix-ui.com/), restyled with the app's tokens. Use them before writing anything new.

## From shadcn/ui and Radix UI

| Component | File | Notes |
| --- | --- | --- |
| `Button` | `button.tsx` | Variants `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`; sizes `default`, `sm`, `lg`, `icon`. `asChild` renders the child instead (Radix `Slot`). Variants are defined with `cva`. |
| `Badge` | `badge.tsx` | Small rounded label; variants `neutral`, `accent`, `success`, `warning`, `danger` |
| `Alert` | `alert.tsx` | Tinted box with an icon for a warning or an error; variants `warning`, `danger` |
| `Checkbox` | `checkbox.tsx` | Radix Checkbox |
| `Collapsible` | `collapsible.tsx` | Radix Collapsible, e.g. for folders in the sidebar |
| `Command` | `command.tsx` | [cmdk](https://cmdk.paco.me/) in a Radix Dialog, used by the command palette |
| `Dialog` | `dialog.tsx` | Radix Dialog with header, footer, title and description |
| `DropdownMenu` | `dropdown-menu.tsx` | Radix Dropdown Menu with items, checkbox and radio items, sub-menus, separators and shortcuts |
| `Input` | `input.tsx` | Text input |
| `Popover` | `popover.tsx` | Radix Popover |
| `Resizable` | `resizable.tsx` | `ResizablePanelGroup`, `ResizablePanel` and `ResizableHandle` on react-resizable-panels |
| `Select` | `select.tsx` | Radix Select |
| `Separator` | `separator.tsx` | Radix Separator |
| `Sidebar` | `sidebar.tsx` | Sidebar layout system with `SidebarProvider`, `useSidebar()`, groups and menus. `Ctrl`/`Cmd` + `B` toggles it. |
| `Skeleton` | `skeleton.tsx` | Pulsing placeholder while content loads |
| `Table` | `table.tsx` | Table, header, body, row and cell |
| `Tabs` | `tabs.tsx` | Radix Tabs |
| `Toaster` | `sonner.tsx` | [sonner](https://sonner.emilkowal.ski/) toasts in the current theme. Show errors with `showError()`, see [Error Handling]({% link documentation/architecture/error-handling.md %}#showing-errors). |
| `Tooltip` | `tooltip.tsx` | Radix Tooltip. `App` sets one `TooltipProvider` with a 750 ms delay. |

## Our own

| Component | File | Notes |
| --- | --- | --- |
| `IconButton` | `icon-button.tsx` | A ghost `Button` sized for a single icon (24 px by default). Give it an `aria-label`, as it has no visible text. |
| `SecretInput` | `secret-input.tsx` | An input that masks its value when `secret` is set, with a button to reveal it |
| `FileDropZone` | `file-drop-zone.tsx` | Accepts dropped or picked files and directories and reports their absolute path (through `window.electron.getAbsoluteFilePath()`), name and MIME type |
| `FilePicker` | `file-picker.tsx` | A `FileDropZone` that shows the chosen file with a button to remove it; controlled or uncontrolled |

## Adding a primitive

1. Check whether shadcn/ui has the component. Add it with the shadcn CLI, or copy it, into `components/ui/`.
2. Replace the shadcn colours with the tokens from `src/renderer/styles/index.css`, as in the existing components, so it works in both themes.
3. Add a test next to it if it has behaviour of its own.

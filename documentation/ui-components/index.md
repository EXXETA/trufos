---
title: UI Components
nav_order: 6
parent: Contributing
has_children: true
description: How the React UI of Trufos is organised, from shadcn/ui primitives to the application components.
---

# UI Components

The UI of Trufos is written in React 19 and TypeScript and styled with Tailwind CSS v4. Its building blocks are [shadcn/ui](https://ui.shadcn.com/) components on [Radix UI](https://www.radix-ui.com/) primitives, which are copied into the repository and adapted to the app's design.

## Where components live

| Directory | Contents |
| --- | --- |
| `src/renderer/components/ui/` | Primitives: shadcn/ui components and a few of our own. See [Core UI Elements]({% link documentation/ui-components/core-elements.md %}). |
| `src/renderer/components/mainWindow/` | The request editor and the response view |
| `src/renderer/components/sidebar/` | The sidebar: collection dropdown, request tree, toolbars |
| `src/renderer/components/history/` | The request history |
| `src/renderer/components/commandPalette/` | The command palette |
| `src/renderer/components/shared/` | Settings modals and editors used in several places |
| `src/renderer/components/icons/` | Custom SVG icons |
| `src/renderer/view/` | Top-level views and dialogs |

The application components are described in [Application Components]({% link documentation/ui-components/application-components.md %}).

## Conventions

- **Reuse before you build.** Look for a component in `components/ui/` first, then for a Radix UI primitive to wrap in the shadcn/ui style. Write a component from scratch only if neither fits; Radix brings focus handling, keyboard navigation and accessibility.
- **Function components and hooks** only, with named exports.
- **Tailwind classes** instead of inline styles or CSS files. Combine conditional classes with `cn()` from `src/renderer/lib/utils.ts`.
- **Design tokens**: colours, radius and fonts are CSS custom properties in `src/renderer/styles/index.css`, available as Tailwind classes such as `bg-accent-primary`, `text-text-secondary` or `text-danger`. Each has a light and a dark value. The design source is a Penpot file; see `AGENTS.md` in the app repository for connecting to it.
- **Icons**: use [lucide-react](https://lucide.dev/) or, for icons from the design, the components in `components/icons/` (`AddIcon`, `BookmarkIcon`, …), which wrap an SVG path in a common `Icon` with consistent sizing.
- **State** that several components share belongs in a store, see [State Management]({% link documentation/architecture/state-management.md %}).
- **Tests** sit next to the component (`*.test.tsx`) and select elements by role and label, as a user would.

## shadcn/ui configuration

`components.json` configures shadcn/ui. Tailwind CSS v4 has no config file, so `tailwind.config` is empty and the CSS entry point is `src/renderer/styles/index.css`. The aliases are `@/components` and `@/lib/utils`, where `@/` is `src/renderer/`.

When you add a component with the shadcn CLI, adapt it to the tokens of `index.css` like the existing ones.

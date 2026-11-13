---
title: Development
nav_order: 7
parent: Contributing
has_children: true
description: The tools and practices used to develop Trufos.
---

# Development

This section covers the tools and practices of day-to-day work on Trufos.

## Tech stack

| Concern | Technology |
| --- | --- |
| Framework | Electron, React 19 |
| Language | TypeScript, strict |
| Build | Vite, Electron Forge |
| Styling | Tailwind CSS v4, shadcn/ui on Radix UI |
| State | Zustand with Immer |
| Validation | Zod |
| HTTP | undici |
| Logging | Winston (main process) |
| Tests | Vitest, Testing Library, Playwright |
| Linting and formatting | ESLint, Prettier |
| Package manager | Yarn 4, with the plugins as workspaces |

## Pages

- [Coding Style]({% link documentation/development/coding-style.md %}): Prettier, ESLint and the code conventions.
- [Testing]({% link documentation/development/testing.md %}): unit, component and end-to-end tests, type checking.
- [Dependencies]({% link documentation/development/dependencies.md %}): the key libraries and what they are used for.
- [Building and Packaging]({% link documentation/development/building-packaging.md %}): Electron Forge, Vite, installers and releases.

## Before you open a pull request

```bash
yarn test
yarn typecheck
yarn lint
yarn prettier-check
```

CI runs all of them except `yarn lint`, plus the end-to-end suite, on every pull request to `main`. Open the pull request against `main`, fill in the template, and link the issue it resolves.

---
title: Coding Style & Formatting
nav_order: 1
parent: Development
description: Formatting with Prettier, linting with ESLint, and the code conventions of Trufos.
---

# Coding Style & Formatting

Formatting and linting are automated. CI checks the formatting; run `yarn lint` yourself before you open a pull request. The conventions beyond that are listed in `AGENTS.md` in the app repository; this page sums up the most important ones.

## Prettier

[Prettier](https://prettier.io/) formats all TypeScript and JavaScript files. `.prettierrc`:

```json
{
  "trailingComma": "es5",
  "tabWidth": 2,
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

`prettier-plugin-tailwindcss` also sorts Tailwind classes.

```bash
yarn prettier-check   # check, as CI does
yarn prettier         # fix
```

Set up your editor to format on save:

- **VS Code**: install [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode). The repository's `.vscode/settings.json` makes it the formatter and turns on format on save.
- **IntelliJ IDEA and WebStorm**: see [Contribution Guidelines]({% link documentation/CONTRIBUTING.md %}#intellij).

## ESLint

[ESLint](https://eslint.org/) uses the flat config in `eslint.config.mjs`:

```bash
yarn lint
```

- `@eslint/js` recommended rules, `typescript-eslint` recommended rules and `eslint-plugin-import-x` with the TypeScript resolver. Unresolved imports are errors.
- Unused variables are errors; prefix a parameter or variable with `_` if it only exists to satisfy a signature.
- Globals per environment: browser for `src/renderer`, Node for `src/main`, `src/shim`, `e2e` and the build tooling.
- **Plugins** (`plugins/**`) may only import the public plugin API (`shim/plugin`), and may not use Node modules or globals that reach outside the process (`node:fs`, `node:child_process`, `fetch`, …). They go through their host instead, see [Plugin Architecture]({% link documentation/architecture/plugins.md %}#design-rules). Tests are exempt.
- Files ignored by `.gitignore` are not linted.

## Conventions

- **Strict TypeScript**: never introduce `any`, and avoid casts such as `as unknown as X` that bypass the type checker.
- **Explicit return types** on exported functions, hooks and public methods, e.g. `buildMenu(): Menu`. Inference is fine for private helpers and inline callbacks.
- **Named exports** for components and utilities. Function components with hooks only.
- **Zod at runtime boundaries**: validate data read from disk, received from the network or from plugins, instead of asserting types. IPC between the processes is not such a boundary.
- **No `JSON.stringify` for comparisons**, cache keys or change detection: key order and lossy values make it unreliable. Compare fields or use a deep-equality helper.
- **Never read request or response bodies completely into memory**: stream them. Only content that has to be in memory anyway, e.g. a script or the text of an editor, may be read completely.
- **Temporary files go through `FileSystemService`**; write files atomically with `replaceFile()`.
- **Logging in main** with the global Winston `logger`, never with secrets, see [Logging]({% link documentation/architecture/logging.md %}).
- **UI**: reuse `components/ui/` and Radix UI before writing a new primitive, style with Tailwind classes and `cn()`. See [UI Components]({% link documentation/ui-components/index.md %}).
- **Comments** explain why, not what. Exported functions, types and services have doc comments.

## Versions of persisted data and APIs

- Bump the **info file version** whenever an older Trufos could not read what is written anymore, e.g. a new field or a new authorization type. See [Collection Schema Versioning]({% link documentation/architecture/schema-versioning.md %}).
- Bump the major **plugin API version** (`PLUGIN_API_VERSION` in `src/shim/plugin/version.ts`) for every breaking change to `shim/plugin`, and update the `engine` ranges of the bundled plugins with it.

## Commits and branches

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) in English, imperative mood, first line under 72 characters, no trailing period:

```
feat: add JSON body editor
fix: keep the selected environment after a reload
```

Types are `feat`, `fix`, `refactor`, `docs`, `chore` and `test`. Branches are named `<type>/<issue-id>-<short-description>` with the types `feature`, `fix` and `tmp`, e.g. `feature/42-json-body-editor`. Open pull requests against `main` and link the issue with `Closes #<issue-id>`.

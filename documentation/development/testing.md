---
title: Testing
nav_order: 2
parent: Development
description: Unit and component tests with Vitest, end-to-end tests with Playwright, and type checking.
---

# Testing

Trufos has three kinds of checks:

| Command | What it checks |
| --- | --- |
| `yarn test` | Unit and component tests with [Vitest](https://vitest.dev/) |
| `yarn typecheck` | Types of every TypeScript project. Vitest does not type-check, so type errors only show up here. |
| `yarn e2e` | End-to-end tests with [Playwright](https://playwright.dev/) against the real app |

Run `yarn test`, `yarn typecheck` and `yarn lint` after every change. CI runs the tests, the type check, `yarn prettier-check` and the end-to-end suite on every pull request; it does not run `yarn lint`.

## Unit and component tests

Tests sit next to the code they test, as `*.test.ts` or `*.test.tsx`, or in a `__tests__/` directory.

`vitest.config.mts` defines one Vitest project per runtime, each with its own configuration:

| Project | Configuration | Environment | Setup |
| --- | --- | --- | --- |
| `main` | `src/main/vite.config.mts` | `node` | `src/main/__mocks__/index.ts` |
| `renderer` | `src/renderer/vite.config.mts` | `jsdom` | `src/renderer/test-setup.ts` |
| `shim` | defaults | `node` | none |
| `plugins` | `plugins/vitest.config.mts` | `node` | none |

```bash
yarn test                         # all projects
yarn test --project renderer      # one project
yarn test src/main/persistence    # files matching a path
yarn test --coverage              # with a coverage report (V8)
```

### Main process

The setup file mocks what does not exist outside Electron:

- `electron` (`app`, `ipcMain`, `safeStorage`, …) from `src/main/__mocks__/electron/`;
- `node:fs` and `node:fs/promises` with [memfs](https://github.com/streamich/memfs), an in-memory file system that is reset before every test, with the temporary and home directories created;
- `node:process`;
- the global `logger`, which writes to the console.

It also adds the matchers `toBeOfSchema(schema)` and `toBeOfSchemaAsync(schema)`, which check a value against a Zod schema.

```ts
import path from 'node:path';
import { vol } from 'memfs';
import { describe, expect, it } from 'vitest';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { StateService } from 'main/persistence/service/state-service';

describe('PersistenceService', () => {
  it('creates the default collection', async () => {
    await PersistenceService.instance.createDefaultCollectionIfNotExists();
    expect(vol.existsSync(path.join(StateService.DEFAULT_COLLECTION_DIR, 'collection.json'))).toBe(true);
  });
});
```

### Renderer

Components are tested with [Testing Library](https://testing-library.com/docs/react-testing-library/intro/) and `@testing-library/user-event`. Select elements by role and accessible name, as a user would find them. `test-setup.ts` adds browser APIs that jsdom lacks and Radix UI or react-resizable-panels need, and cleans up after each test. `monaco-editor` is aliased to its ESM API so it loads under jsdom; `src/renderer/__mocks__/` has helpers for Monaco models and a fake main process for the collection store.

Mock the IPC layer (`RendererEventService`) rather than `window.electron`, and test stores through their actions.

### Plugins

Plugin tests use the real file system and only the public plugin API, so they need none of the main-process mocks. `bundled-plugins.test.ts` activates every bundled plugin with the host its manifest allows, so a missing permission fails CI.

## End-to-end tests

The `e2e/` suite drives the real Electron app (main process, preload, renderer and IPC) through the production bundles in `.vite/build/`:

```bash
yarn package   # builds the bundles the suite launches
yarn e2e       # runs the suite
yarn e2e:ui    # runs it in Playwright's UI mode
```

- Run `yarn package` before the suite, and again after every change to the sources. `yarn package` records a fingerprint of the sources (`tools/source-fingerprint.ts`), and the suite refuses bundles that are older. It also refuses the development bundles that `yarn start` leaves behind.
- Every test launches a fresh app with a temporary `--user-data-dir`, so nothing touches your own settings or collections.
- Requests go to a local echo server (`e2e/fixtures/echo-server.ts`). Tests must not depend on external services.
- Shared locators and interactions are in `e2e/helpers/`; tests are in `e2e/specs/`.
- A failed test leaves a trace, a screenshot and the main-process log in `e2e/test-results/`.
- Tests run one at a time, as each app takes the window focus.

The packaged app (asar, Electron fuses) is not covered: the release fuses disable the inspector Playwright attaches through. In CI, which has no keyring, the app falls back to unencrypted `safeStorage`; this fallback only exists in unpackaged builds with `CI` set.

{: .note }
In a VS Code terminal, `ELECTRON_RUN_AS_NODE` may be set, which starts Electron as plain Node and makes every launch fail. Unset it first: `env -u ELECTRON_RUN_AS_NODE yarn e2e`.

## Type checking

```bash
yarn typecheck
```

runs `tsc` for `src/shim`, `src/main`, `src/renderer`, `plugins`, `e2e` and the build tooling at the root, each with its own `tsconfig.json`. `src/shim` is the strictest: it has no DOM types, so nothing renderer-specific can leak into code that main compiles too.

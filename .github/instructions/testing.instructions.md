---
applyTo: '**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.spec.tsx'
description: Testing standards for the Trufos project using Vitest and Testing Library
---

# Testing Instructions

> **Scope:** everything below describes the Vitest unit/component tests (`*.test.ts(x)`).
> Files under `e2e/` are Playwright end-to-end tests — see the dedicated section at the end;
> the Vitest, jsdom and mocking rules do not apply there.

## Framework & Tools

- **Test runner:** Vitest
- **UI testing:** `@testing-library/react` + `@testing-library/user-event`
- **DOM environment:** jsdom (configured in `vitest.config.mts`)
- **Mocking:** Vitest built-in mocks (`vi.mock`, `vi.fn`, `vi.spyOn`); `memfs` for file system operations. Note: the file system is always auto-mocked in main-process tests via `src/main/__mocks__`.

## Test Structure

- Place test files **co-located** with their source file (e.g., `requestUtils.test.ts` next to `requestUtils.ts`).
- Use descriptive `describe` blocks to group related tests.
- Use clear `it` / `test` descriptions: *"should \<behaviour\> when \<condition\>"*.
- Follow the **Arrange → Act → Assert** pattern in every test.

```ts
describe('formatHeaders', () => {
  it('should return an empty object when given no headers', () => {
    // Arrange
    const input: Header[] = [];
    // Act
    const result = formatHeaders(input);
    // Assert
    expect(result).toEqual({});
  });
});
```

## React Component Testing

- Use `render` from `@testing-library/react` and query elements with accessible queries (`getByRole`, `getByLabelText`, `getByText`) in preference to `getByTestId`.
- Use `userEvent` (not `fireEvent`) for simulating user interactions.
- Mock Electron IPC and preload APIs – do not rely on actual IPC in renderer tests.
- Test component behaviour from the user's perspective, not implementation details.

## Mocking

- Mock external dependencies at the module level with `vi.mock(...)`.
- Use `vi.spyOn` to observe calls without replacing implementations.
- Reset mocks between tests with `vi.clearAllMocks()` or `beforeEach`.
- Use `memfs` for any test involving file system operations.

## Coverage & Quality

- Cover the **happy path**, **error cases**, and relevant **edge cases**.
- Do not write tests that just check internal implementation details (avoid testing state directly).
- Avoid snapshot tests for logic-heavy code; prefer explicit assertions.
- Aim for meaningful coverage on services, stores, and utility functions.

## Running Tests

```bash
yarn test          # Run all tests once
yarn test --watch  # Watch mode during development
```

## End-to-End Tests (Playwright, `e2e/`)

The `e2e/` suite launches the real Electron app from the production bundles in `.vite/build/` and
exercises main process, preload, renderer and IPC together. Rules that differ from unit tests:

- **Nothing is mocked.** Requests go to the local echo server fixture
  (`e2e/fixtures/echo-server.ts`); never depend on external services. Native dialogs are the one
  exception — stub them through the helpers in `e2e/helpers/main-process.ts`.
- Each test gets a fresh app instance with a temporary `--user-data-dir`; put shared locators and
  interactions in `e2e/helpers/` instead of repeating selectors.
- Prefer accessible selectors (roles, labels, visible names). Add `data-testid` only where no
  stable user-facing selector exists.
- Monaco editors do not behave like inputs: their accessible name sits on a hidden element, so
  use the `urlEditor`/`setUrl` helpers rather than `getByRole('textbox')` + `fill()`.

```bash
yarn package       # Build the bundles the suite runs (required first; rerun after `yarn start`)
yarn e2e           # Run the end-to-end suite
yarn e2e:ui        # Debug interactively in Playwright's UI mode
```

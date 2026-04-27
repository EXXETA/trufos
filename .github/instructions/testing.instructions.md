---
applyTo: '**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.spec.tsx'
description: Testing standards for the Trufos project using Vitest and Testing Library
---

# Testing Instructions

## Framework & Tools

- **Test runner:** Vitest
- **UI testing:** `@testing-library/react` + `@testing-library/user-event`
- **DOM environment:** jsdom (configured in `vitest.config.ts`)
- **Mocking:** Vitest built-in mocks (`vi.mock`, `vi.fn`, `vi.spyOn`); `memfs` for file system operations

## Test Structure

- Place test files **co-located** with their source file (e.g., `requestUtils.test.ts` next to `requestUtils.ts`) or in a `__tests__/` subdirectory.
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

---
title: Testing
nav_order: 2
parent: Development Practices
---

# Testing

Trufos uses [Vitest](https://vitest.dev/) as its test runner for both unit and integration tests. Tests are co-located with the source code in `__tests__` directories or with a `.test.ts` (or `.test.tsx`) suffix.

## Configuration

Vitest configurations are specific to the main and renderer processes due to their different environments:

1.  **Main Process Tests**:
    *   **Config File**: `src/main/vite.config.ts`
    *   **Environment**: `node` (as the main process runs in a Node.js environment).
    *   **Setup File**: `src/main/__mocks__/index.ts`
        *   This setup file is crucial. It mocks global `logger` and Electron modules (`electron`, `node:fs`, `tmp`) to allow tests to run outside a full Electron environment.
        *   It uses `memfs` for an in-memory file system for tests involving file operations.
        *   Includes a `beforeEach` hook to reset the in-memory file system and create temporary/home directories.
    *   **Aliases**: Configured for `main` and `shim` directories.

2.  **Renderer Process Tests**:
    *   **Config File**: `src/renderer/vite.config.ts`
    *   **Environment**: `jsdom` (to simulate a browser environment for React components).
    *   **Plugins**: Includes `@vitejs/plugin-react` for JSX and React support.
    *   **Aliases**:
        *   Configured for `@/` (pointing to `src/renderer/`) and `shim`.
        *   Crucially, it aliases `monaco-editor` to its ESM API entry point (`monaco-editor/esm/vs/editor/editor.api`) to prevent issues with Monaco's worker imports in a test environment.
    *   **Mocks**: Renderer-specific mocks can be found in `src/renderer/__mocks__/`, such as `monaco-util.ts` for mocking Monaco editor models.

## Running Tests

To execute all tests for both main and renderer processes:

```bash
yarn test
```

This command runs `vitest run`, which will discover and execute all test files matching the configured patterns.

## Writing Tests

*   **File Naming**: Test files should typically end with `.test.ts` or `.test.tsx`.
*   **Assertion Library**: Vitest uses Chai-compatible assertions via `expect`.
*   **Mocking**:
    *   Utilize Vitest's mocking capabilities (`vi.mock`, `vi.spyOn`, etc.).
    *   For Electron-specific features or Node.js modules in the main process, leverage the mocks provided in `src/main/__mocks__/`.
    *   For renderer components relying on Monaco or other browser/Electron features, create mocks as needed (see `src/renderer/__mocks__/monaco-util.ts`).
*   **Focus**:
    *   **Main Process**: Tests often focus on service logic, data manipulation, file system interactions (using `memfs`), and IPC handler logic (though full IPC might be harder to unit test without integration tests).
    *   **Renderer Process**: Tests often focus on React component rendering and behavior (using `@testing-library/react`), state store logic, and utility functions.

## Coverage

To generate a test coverage report (configured in `package.json` likely via Vitest's coverage options, using `@vitest/coverage-v8`):
While not explicitly defined as a separate script in the provided `package.json`, Vitest can be configured to output coverage. Typically, you might run:
```bash
yarn test --coverage
```
(Check Vitest documentation or project's specific setup if this command needs adjustment).

Coverage reports help identify untested parts of the codebase.

## Example Test Structure (Conceptual)

```typescript
// Example: src/main/some-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SomeService } from './some-service';
import { fs } from 'memfs'; // If using in-memory fs

// Mock dependencies
vi.mock('path/to/dependency', () => ({
  // ... mock implementation
}));

describe('SomeService', () => {
  beforeEach(() => {
    fs.reset(); // Reset memfs before each test
    // ... other setup
  });

  it('should do something correctly', async () => {
    const service = new SomeService();
    const result = await service.someMethod();
    expect(result).toEqual('expectedValue');
  });
});
```

Refer to existing tests within the codebase for practical examples and patterns used in Trufos. 
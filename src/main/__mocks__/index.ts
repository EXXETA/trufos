import { homedir, tmpdir } from 'node:os';
import { vol } from 'memfs';
import { vi, beforeEach, expect } from 'vitest';
import { prettifyError, ZodSafeParseResult } from 'zod';

// @ts-expect-error mock global logger with console
global.logger = console;
global.logger.secret = console;

vi.mock('electron');
vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('node:process');
vi.mock('tmp');

beforeEach(() => {
  vi.clearAllMocks();
  vol.reset();
  vol.mkdirSync(tmpdir(), { recursive: true });
  vol.mkdirSync(homedir(), { recursive: true });
});

expect.extend({
  toBeZodSuccess<T>(result: ZodSafeParseResult<T>) {
    return {
      pass: result.success,
      message: () =>
        result.success
          ? 'Expected Zod parse to fail, but it succeeded.'
          : prettifyError(result.error),
    };
  },
});

declare module 'vitest' {
  interface Assertion<T = any> {
    toBeZodSuccess(): T;
  }
}

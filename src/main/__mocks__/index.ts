import { homedir, tmpdir } from 'node:os';
import { vol } from 'memfs';
import { vi, beforeEach, expect } from 'vitest';
import { prettifyError, ZodSafeParseResult, ZodType, ZodTypeAny } from 'zod';

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
  toBeOfSchema(received: unknown, schema: ZodTypeAny) {
    const result = schema.safeParse(received);
    return {
      pass: result.success,
      message: () =>
        result.success
          ? 'Expected value to not match schema, but it did.'
          : prettifyError(result.error),
    };
  },
  async toBeOfSchemaAsync(received: unknown, schema: ZodTypeAny) {
    const result = await schema.safeParseAsync(received);
    return {
      pass: result.success,
      message: () =>
        result.success
          ? 'Expected value to not match schema, but it did.'
          : prettifyError(result.error),
    };
  },
});

declare module 'vitest' {
  interface Assertion {
    toBeOfSchema(schema: ZodTypeAny): void;
    toBeOfSchemaAsync(schema: ZodTypeAny): Promise<void>;
  }
}

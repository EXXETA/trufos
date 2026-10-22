import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Plugins run in the main process, but their tests use the real file system and only the public
// plugin API, so they need none of the mocks of src/main.
export default defineConfig({
  resolve: {
    alias: {
      shim: path.resolve(import.meta.dirname, '..', 'src', 'shim'),
    },
  },
  test: {
    name: 'plugins',
    environment: 'node',
  },
});

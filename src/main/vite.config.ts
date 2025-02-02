import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      main: __dirname,
      shim: path.resolve(__dirname, '..', 'shim'),
    },
  },
  test: {
    name: 'main',
    environment: 'node',
    setupFiles: path.join(__dirname, '__mocks__', 'index.ts'),
  },
});

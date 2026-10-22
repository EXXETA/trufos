import { defineConfig } from 'vitest/config';
import path from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  resolve: {
    alias: {
      main: import.meta.dirname,
      shim: path.resolve(import.meta.dirname, '..', 'shim'),
      plugins: path.resolve(import.meta.dirname, '..', '..', 'plugins'),
      // Force CJS entry: ohm-js ESM bundle only exports { default, extras },
      // so require('ohm-js').grammar is undefined without this alias.
      'ohm-js': path.resolve(import.meta.dirname, '..', '..', 'node_modules', 'ohm-js', 'index.js'),
    },
  },
  server: {
    watch: {
      ignored: (path) => !path.startsWith(import.meta.dirname),
    },
  },
  test: {
    name: 'main',
    environment: 'node',
    setupFiles: path.join(import.meta.dirname, '__mocks__', 'index.ts'),
  },
  build: {
    sourcemap: isProduction ? true : 'inline',
    minify: false,
  },
});

import { defineConfig } from 'vitest/config';
import path from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  resolve: {
    alias: {
      main: __dirname,
      shim: path.resolve(__dirname, '..', 'shim'),
      // Force CJS entry: ohm-js ESM bundle only exports { default, extras },
      // so require('ohm-js').grammar is undefined without this alias.
      'ohm-js': path.resolve(__dirname, '..', '..', 'node_modules', 'ohm-js', 'index.js'),
    },
  },
  server: {
    watch: {
      ignored: (path) => !path.startsWith(__dirname),
    },
  },
  test: {
    name: 'main',
    environment: 'node',
    setupFiles: path.join(__dirname, '__mocks__', 'index.ts'),
  },
  build: {
    sourcemap: isProduction ? true : 'inline',
    minify: false,
  },
});

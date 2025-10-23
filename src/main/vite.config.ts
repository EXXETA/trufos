import { defineConfig } from 'vitest/config';
import path from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';

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
  build: {
    sourcemap: isProduction ? true : 'inline',
    minify: false,
  },
});

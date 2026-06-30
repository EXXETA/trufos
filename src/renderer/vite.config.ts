import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { monacoAmdPlugin } from './lib/monaco/vite-plugin';

export default defineConfig({
  plugins: [react({}), tailwindcss(), monacoAmdPlugin()],
  resolve: {
    alias: {
      '@': __dirname,
      shim: path.resolve(__dirname, '..', 'shim'),
    },
  },
  server: {
    watch: {
      ignored: (path) => !path.startsWith(__dirname),
    },
  },
  test: {
    name: 'renderer',
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts'],
    alias: [
      {
        find: /^monaco-editor$/,
        replacement: path.join(
          __dirname,
          '..',
          '..',
          'node_modules',
          'monaco-editor',
          'esm',
          'vs',
          'editor',
          'editor.api'
        ),
      },
    ],
  },
});

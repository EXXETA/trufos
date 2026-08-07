import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { monacoAmdPlugin } from './lib/monaco/vite-plugin.mts';

export default defineConfig({
  plugins: [react({}), tailwindcss(), monacoAmdPlugin()],
  resolve: {
    alias: {
      '@': import.meta.dirname,
      shim: path.resolve(import.meta.dirname, '..', 'shim'),
    },
  },
  server: {
    watch: {
      ignored: (path) => !path.startsWith(import.meta.dirname),
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
          import.meta.dirname,
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

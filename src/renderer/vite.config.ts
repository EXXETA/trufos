import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': __dirname,
      shim: path.resolve(__dirname, '..', 'shim'),
    },
  },
  test: {
    name: 'renderer',
    environment: 'jsdom',
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

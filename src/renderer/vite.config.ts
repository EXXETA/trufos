import { defineConfig } from 'vitest/config';
import PluginReact from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [PluginReact()],
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

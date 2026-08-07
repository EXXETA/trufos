import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import path from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * `@electron-forge/plugin-vite` (7.11.2, latest) still configures the preload build with
 * Rolldown's deprecated `output.inlineDynamicImports`, which logs a deprecation warning on every
 * dev start. Rewrite it to its successor `codeSplitting: false` — Rolldown maps that back to
 * `inlineDynamicImports: true` internally, so the emitted bundle is unchanged. Drop this once
 * Forge stops setting the deprecated option.
 */
function replaceDeprecatedInlineDynamicImports(): Plugin {
  return {
    name: 'trufos:replace-deprecated-inline-dynamic-imports',
    config(config) {
      for (const options of [config.build?.rollupOptions, config.build?.rolldownOptions]) {
        const output = options?.output;
        if (output == null || Array.isArray(output) || output.inlineDynamicImports == null)
          continue;
        delete output.inlineDynamicImports;
        output.codeSplitting = false;
      }
    },
  };
}

export default defineConfig({
  plugins: [replaceDeprecatedInlineDynamicImports()],
  resolve: {
    alias: {
      main: import.meta.dirname,
      shim: path.resolve(import.meta.dirname, '..', 'shim'),
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

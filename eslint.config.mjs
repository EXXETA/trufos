import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { flatConfigs as importXConfigs } from 'eslint-plugin-import-x';
import gitignore from 'eslint-config-flat-gitignore';
import globals from 'globals';
import { builtinModules } from 'node:module';

/** Everything written in TypeScript: app code, tests and build tooling. */
const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts'];

const PLUGIN_API_MESSAGE = 'Plugins may only import from "shim/plugin", the public plugin API.';

/**
 * The `no-restricted-imports` options that keep plugins on the public plugin API, `shim/plugin`.
 * @param {{ name: string, message: string }[]} morePaths modules to restrict in addition
 */
function pluginImports(morePaths = []) {
  return {
    paths: [
      ...['main', 'shim'].map((name) => ({ name, message: PLUGIN_API_MESSAGE })),
      ...morePaths,
    ],
    patterns: [
      {
        group: ['main/*', '@/*', 'shim/*', '!shim/plugin', '**/src/*/**'],
        message: PLUGIN_API_MESSAGE,
      },
    ],
  };
}

/** Node modules that only compute and never reach the file system, network or other processes. */
const PURE_NODE_MODULES = new Set([
  'assert',
  'assert/strict',
  'buffer',
  'crypto',
  'events',
  'path',
  'path/posix',
  'path/win32',
  'querystring',
  'stream',
  'stream/consumers',
  'stream/promises',
  'stream/web',
  'string_decoder',
  'timers',
  'timers/promises',
  'url',
  'util',
  'util/types',
  'zlib',
]);

/** Every Node module a plugin must get through its host instead, with and without `node:`. */
const NODE_BUILTINS = builtinModules
  .filter((name) => !name.startsWith('node:') && !PURE_NODE_MODULES.has(name))
  .flatMap((name) => [name, `node:${name}`])
  .map((name) => ({
    name,
    message:
      'Plugins reach the file system, network and other processes through their host only, see PluginHost.',
  }));

/** Build tooling that runs in Node outside the app itself (Forge, Vite and Vitest configs). */
const TOOLING_FILES = [
  'eslint.config.mjs',
  'forge.config.ts',
  'vitest.config.mts',
  'src/*/vite.config.mts',
  'tools/**',
];

export default [
  gitignore(),
  js.configs.recommended,
  importXConfigs.recommended,

  // TypeScript. The shipped flat configs are scoped to TS files so the TypeScript parser is not
  // pulled in for plain `.js`/`.cjs` files (the example scripts and the CommonJS test mocks).
  ...tsPlugin.configs['flat/recommended'].map((config) => ({
    ...config,
    files: config.files ?? TS_FILES,
  })),
  { ...importXConfigs.typescript, files: TS_FILES },
  {
    files: TS_FILES,
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    settings: {
      // Neither is resolvable from disk: `electron` is provided by the runtime, and
      // `virtual:monaco-workers` is emitted by our own Vite plugin.
      'import-x/core-modules': ['electron', 'virtual:monaco-workers'],
      'import-x/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      'import-x/no-unresolved': 'error',
      // An underscore prefix marks a binding that only exists to satisfy a signature.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Renderer process (React), including its jsdom tests.
  {
    files: ['src/renderer/**'],
    languageOptions: { globals: globals.browser },
  },

  // Main process and the shared shim both run in Node.
  {
    files: ['src/main/**', 'src/shim/**'],
    languageOptions: { globals: globals.node },
  },

  // Plugins run in the main process and may only use the public plugin API, `shim/plugin`.
  {
    files: ['plugins/**'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-restricted-imports': ['error', pluginImports()],
    },
  },

  // Everything a plugin does outside the app goes through a capability of its host, which it only
  // gets for a permission in its manifest. Node's own modules and the network globals would bypass
  // that by accident, so plugin code may only use what stays inside the process. Tests set up files
  // and are exempt. A rule's options replace the previous block's, so the plugin API restriction is
  // repeated here.
  {
    files: ['plugins/**'],
    ignores: ['plugins/**/*.test.ts', 'plugins/**/*.config.mts'],
    rules: {
      'no-restricted-imports': ['error', pluginImports(NODE_BUILTINS)],
      'no-restricted-globals': [
        'error',
        ...['fetch', 'WebSocket'].map((name) => ({
          name,
          message: 'Plugins reach the network through host.fetch only, see PluginHost.',
        })),
      ],
    },
  },

  // End-to-end suite, which runs in Node via the Playwright runner.
  {
    files: ['e2e/**'],
    languageOptions: { globals: globals.node },
    rules: {
      // Playwright detects which fixtures a fixture depends on from its destructuring pattern, so
      // one without dependencies has to be written as `async ({}, use) => …`.
      'no-empty-pattern': 'off',
    },
  },

  // CommonJS test mocks, which have to use `require()` to be loadable as CJS.
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  // Example collection scripts run inside the app's scripting sandbox, against its global API.
  {
    files: ['examples/**/*.js'],
    languageOptions: { globals: { trufos: 'readonly' } },
  },

  // Listed last so tooling that lives inside `src/renderer` and `src/main` still gets Node globals.
  {
    files: TOOLING_FILES,
    languageOptions: { globals: globals.node },
  },
];

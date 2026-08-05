import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { flatConfigs as importXConfigs } from 'eslint-plugin-import-x';
import gitignore from 'eslint-config-flat-gitignore';
import globals from 'globals';

/** Everything written in TypeScript: app code, tests and build tooling. */
const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts'];

/** Build tooling that runs in Node outside the app itself (Forge, Vite and Vitest configs). */
const TOOLING_FILES = [
  'eslint.config.mjs',
  'forge.config.ts',
  'vitest.config.mts',
  'src/*/vite.config.mts',
  'src/renderer/lib/monaco/vite-plugin.mts',
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

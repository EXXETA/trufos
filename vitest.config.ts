import { defineConfig, defineWorkspace } from 'vitest/config';
import path from 'node:path';

const srcDir = path.join(__dirname, 'src');
const mainDir = path.join(srcDir, 'main');
const rendererDir = path.join(srcDir, 'renderer');
const shimDir = path.join(srcDir, 'shim');

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: 'lcov',
    },
    sequence: {
      hooks: 'stack', // ensures that the FS mocks are registered as first hooks
    },
    workspace: defineWorkspace([
      {
        test: {
          name: 'main',
          root: mainDir,
          environment: 'node',
          setupFiles: path.join(mainDir, '__mocks__', 'index.ts'),
          alias: {
            main: mainDir,
            shim: shimDir,
          },
        },
        extends: true,
      },
      {
        test: {
          name: 'renderer',
          root: rendererDir,
          environment: 'jsdom',
          alias: [
            { find: '@', replacement: rendererDir },
            { find: 'shim', replacement: shimDir },
            {
              find: /^monaco-editor$/,
              replacement: path.join(
                __dirname,
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
        extends: true,
      },
    ]),
  },
});

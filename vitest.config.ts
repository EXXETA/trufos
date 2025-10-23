import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['src/main', 'src/renderer'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['**/__mocks__', '**/vite.config.ts', '**/*.d.ts'],
    },
  },
});

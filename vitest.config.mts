import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['src/main', 'src/renderer', 'src/shim', 'plugins'],
    coverage: {
      provider: 'v8',
      include: ['src/**', 'plugins/**'],
      exclude: ['**/__mocks__', '**/vite.config.*', '**/*.d.ts'],
    },
  },
});

import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for the Electron end-to-end suite.
 *
 * Unlike browser projects, every diagnostic (trace, screenshot) is wired up by the
 * `trufos-app` fixture itself: `use.trace` and friends only apply to contexts the runner creates,
 * and an Electron application brings its own. See `fixtures/trufos-app.ts`.
 */
export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',

  // Each test drives a full Electron application that takes over window focus, so the tests must
  // not compete for it.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // Launching Electron plus the first paint of the renderer is far slower than a browser page
  // load.
  timeout: 90_000,
  expect: { timeout: 15_000 },

  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: './playwright-report', open: 'never' }], ['list']]
    : [['list']],
});

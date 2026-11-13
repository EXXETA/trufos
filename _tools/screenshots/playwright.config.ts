// Run from the Trufos app checkout, which provides Playwright and the e2e fixtures:
//   cd ../trufos && yarn package
//   yarn playwright test --config ../trufos-docs/_tools/screenshots/playwright.config.ts
// See screenshots.spec.ts.
export default {
  testDir: '.',
  testMatch: 'screenshots.spec.ts',
  outputDir: '../../_screenshots/.test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
};

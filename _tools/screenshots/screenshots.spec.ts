/**
 * Takes the User Guide screenshots in both themes by driving the real app with Playwright, reusing
 * the e2e fixtures of the Trufos app repository. Every screenshot starts a fresh app instance with
 * its own data folder in `_screenshots/.work/`, so your own collections are never touched.
 *
 *   cd ../trufos && yarn package        # the fixtures refuse bundles older than the sources
 *   yarn playwright test --config ../trufos-docs/_tools/screenshots/playwright.config.ts
 *   cd ../trufos-docs && node _tools/optimize-screenshots.mjs
 *
 * The app checkout is expected next to this repository; set TRUFOS_DIR to use another one.
 * Add `-g <name>` to the playwright command to take only some of the screenshots.
 */
import path from 'node:path';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const TRUFOS_DIR = path.resolve(process.env.TRUFOS_DIR ?? path.join(HERE, '..', '..', '..', 'trufos'));
const app = (file: string) => require(path.join(TRUFOS_DIR, 'e2e', file));
const { test: base, expect } = app('fixtures/trufos-app');
const { openAppSettings, stubDirectoryPicker } = app('helpers/main-process');
const { selectRequest, sendRequest, responseStatus, responseTab, setUrl, sidebarItem } = app('helpers/ui');

const DOCS_DIR = path.resolve(HERE, '..', '..');
const OUTPUT_DIR = path.join(DOCS_DIR, '_screenshots');
const WORK_DIR = path.join(DOCS_DIR, '_screenshots', '.work');
const COLLECTIONS_DIR = path.join(WORK_DIR, 'Collections');
const OPENAPI_FILE = path.join(HERE, 'bookshop-openapi.yaml');

/** The size of the window content in CSS pixels, and the scale it is rendered at. */
const CONTENT_SIZE = { width: 1280, height: 838 };
const SCALE = 1.25;
const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

// A fixed data folder instead of a temporary one: its path shows up in the app, e.g. in the
// collection dropdown, and the temporary folder would contain the user name.
const test = base.extend({
  userDataDir: async ({}, use: (dir: string) => Promise<void>) => {
    const dir = path.join(WORK_DIR, 'Trufos');
    await rm(WORK_DIR, { recursive: true, force: true });
    await mkdir(COLLECTIONS_DIR, { recursive: true });
    await use(dir);
  },
  // rendered at 1.25x, so the screenshots come out 1600 x 1050 and sharp
  trufos: async ({ launchTrufos }: any, use: (app: any) => Promise<void>) => {
    await use(await launchTrufos({ args: [`--force-device-scale-factor=${SCALE}`] }));
  },
});

/** Sizes the window and switches to the theme. */
async function prepare(trufos: any, theme: Theme, size = CONTENT_SIZE) {
  await trufos.app.evaluate(({ BrowserWindow }: any, size: typeof CONTENT_SIZE) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window.isMaximized()) window.unmaximize();
    window.setContentSize(size.width, size.height);
  }, size);

  const { window } = trufos;
  await openAppSettings(trufos.app);
  const dialog = window.getByRole('dialog');
  await dialog.getByRole('button', { name: theme === 'light' ? 'Light' : 'Dark', exact: true }).click();
  await expect(window.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`));
  await window.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

/**
 * Saves a screenshot of the window as `_screenshots/<name>-<theme>.png`. Pass `hover` to show the
 * hover of an element in the picture; otherwise the mouse is moved out of the way.
 */
async function shoot(
  window: any,
  name: string,
  theme: Theme,
  size = CONTENT_SIZE,
  hover?: () => Promise<void>
) {
  if (hover) {
    await hover();
  } else {
    // away from the sidebar and from buttons, so no hover state ends up in the picture
    await window.mouse.move(size.width - 4, size.height - 4);
  }
  await window.waitForTimeout(500);
  const file = path.join(OUTPUT_DIR, `${name}-${theme}.png`);
  await mkdir(path.dirname(file), { recursive: true });
  await window.screenshot({
    path: file,
    animations: 'disabled',
    caret: 'hide',
  });
}

/** Imports the demo OpenAPI document as the collection "Bookshop API" and opens it. */
async function importBookshop(trufos: any) {
  const { window } = trufos;
  await stubDirectoryPicker(trufos.app, COLLECTIONS_DIR);
  await window.getByRole('button', { name: 'Default Collection' }).click();
  await window.getByRole('menuitem', { name: 'Import Collection' }).click();

  const dialog = window.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'OpenAPI' }).click();
  await dialog.locator('input[type="file"]').setInputFiles(OPENAPI_FILE);
  await dialog.getByRole('button', { name: /Select directory for new collection/ }).click();
  await dialog.getByPlaceholder('Name of the new collection').fill('Bookshop API');
  await dialog.getByRole('button', { name: 'Complete Import' }).click();

  await expect(window.getByRole('button', { name: 'Bookshop API' })).toBeVisible();
  await expect(dialog).toBeHidden();
}

/** Turns the example request into a POST with variables in its JSON body and sends it. */
async function sendVariableRequest(window: any) {
  await selectRequest(window, 'Example Request');

  await window.getByRole('combobox').filter({ hasText: /^GET$/ }).click();
  await window.getByRole('option', { name: 'POST', exact: true }).click();
  // echoes the JSON body only, unlike the default echo service, which adds the IP address
  await setUrl(window, 'https://jsonplaceholder.typicode.com/posts');

  await window.getByRole('combobox').filter({ hasText: /^Plain$/ }).click();
  await window.getByRole('option', { name: 'JSON', exact: true }).click();

  const body = window.locator('.monaco-editor').nth(1);
  await body.click();
  await window.keyboard.insertText(
    '{"title": "{{variable1}}", "userId": 1, "requestId": "{{$randomUuid}}", "sentAt": "{{$timestampIso}}"}'
  );
  await window.getByRole('button', { name: 'Format' }).click();

  await sendRequest(window);
  await expect(responseStatus(window)).toContainText('201');
}

/** Hovers `{{variable1}}` in the request body, so the hover shows its current value. */
async function hoverVariable(window: any) {
  const body = window.locator('.monaco-editor').nth(1);
  await body.locator('.view-line').getByText('variable1').first().hover();
  await expect(window.locator('.monaco-hover').filter({ hasText: 'Current value' })).toBeVisible();
}

/** Expands a folder in the sidebar. */
async function openFolder(window: any, name: string, firstRequest: string) {
  await window.getByText(name, { exact: true }).click();
  await expect(sidebarItem(window, firstRequest)).toBeVisible();
}

/**
 * Writes the Open Graph image (1200 x 630, PNG, as social networks expect) from a screenshot. The
 * window cannot be made that small, so the screenshot is scaled to 1200 px wide and its top part
 * is kept, cutting off empty space at the bottom of the editors.
 */
async function writeSocialPreview(screenshot: string) {
  const sharp = require(path.join(DOCS_DIR, '_tools', 'node_modules', 'sharp'));
  await sharp(screenshot)
    .resize({ width: 1200 })
    .extract({ left: 0, top: 0, width: 1200, height: 630 })
    .png({ palette: true, quality: 90 })
    .toFile(path.join(DOCS_DIR, 'assets', 'images', 'social-preview.png'));
}

for (const theme of THEMES) {
  test(`empty-state ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await importBookshop(trufos);
    await openFolder(window, 'Books', 'List books');
    await openFolder(window, 'Orders', 'List orders');
    await shoot(window, 'empty-state', theme);
  });


  test(`first-steps-default-collection ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await selectRequest(window, 'Example Request');
    await sendRequest(window);
    await expect(responseStatus(window)).toContainText('200');
    // the echoed body contains the public IP address of the machine taking the screenshot
    await responseTab(window, 'Headers').click();
    await shoot(window, 'user-guide/first-steps-default-collection', theme);
  });

  test(`request-variable ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await sendVariableRequest(window);
    await shoot(window, 'request-variable', theme, CONTENT_SIZE, () => hoverVariable(window));
    if (theme === 'dark') await writeSocialPreview(path.join(OUTPUT_DIR, 'request-variable-dark.png'));
  });

  test(`collections-dropdown ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await importBookshop(trufos);
    await window.getByRole('button', { name: 'Bookshop API' }).click();
    await expect(window.getByRole('menuitem', { name: 'New Collection' })).toBeVisible();
    await shoot(window, 'user-guide/collections-dropdown', theme);
  });

  test(`collections-multi-select ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await importBookshop(trufos);
    await openFolder(window, 'Books', 'List books');
    await openFolder(window, 'Orders', 'List orders');
    await selectRequest(window, 'List books');
    for (const name of ['Create a book', 'Get a book', 'Update a book']) {
      await sidebarItem(window, name).click({ modifiers: ['ControlOrMeta'] });
    }
    await expect(window.getByText('3 items selected')).toBeVisible();
    await shoot(window, 'user-guide/collections-multi-select', theme);
  });

  test(`authorization-request-tab ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await importBookshop(trufos);
    await openFolder(window, 'Books', 'List books');
    await selectRequest(window, 'Create a book');
    await window.getByRole('tab', { name: 'Auth', exact: true }).click();
    // the imported requests inherit the OAuth 2.0 authorization of the collection
    const panel = window.getByRole('tabpanel', { name: 'Auth' });
    await panel.getByRole('combobox').first().click();
    await window.getByRole('option', { name: 'OAuth 2.0', exact: true }).click();
    await panel.getByRole('combobox').nth(1).click();
    await window.getByRole('option', { name: 'Authorization Code with PKCE', exact: true }).click();
    await window.getByPlaceholder('https://example.com/oauth2/token').fill('https://auth.bookshop.example/realms/shop/protocol/openid-connect/token');
    await window.getByPlaceholder('https://example.com/oauth2/authorize').fill('https://auth.bookshop.example/realms/shop/protocol/openid-connect/auth');
    await window.getByPlaceholder('(optional, space-separated)').fill('books.read books.write');
    await window.getByPlaceholder('Enter client ID').fill('bookshop-cli');
    await window.getByPlaceholder('https://example.com/oauth2/issuer').fill('https://auth.bookshop.example/realms/shop');
    await window.getByPlaceholder('https://example.com/oauth2/callback').fill('http://localhost:8080/callback');
    await window.locator('body').click({ position: { x: CONTENT_SIZE.width - 4, y: 4 } });
    // filling the fields scrolled the form; show it from the top
    await panel.getByText('Authorization Type').evaluate((label: HTMLElement) => label.scrollIntoView({ block: 'start' }));
    await shoot(window, 'user-guide/authorization-request-tab', theme);
  });

  test(`import-dialog ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    const source = path.join(WORK_DIR, 'Bookshop.postman_collection.json');
    await copyFile(path.join(TRUFOS_DIR, 'e2e', 'fixtures', 'data', 'postman-collection.json'), source);
    await stubDirectoryPicker(trufos.app, COLLECTIONS_DIR);

    await window.getByRole('button', { name: 'Default Collection' }).click();
    await window.getByRole('menuitem', { name: 'Import Collection' }).click();
    const dialog = window.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Postman' }).click();
    await dialog.locator('input[type="file"]').setInputFiles(source);
    await dialog.getByRole('button', { name: /Select directory for new collection/ }).click();
    await dialog.getByPlaceholder('Name of the new collection').fill('Bookshop');
    await shoot(window, 'user-guide/import-dialog', theme);
  });

  test(`export-tab ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await importBookshop(trufos);
    await window.getByRole('button', { name: 'Collection settings' }).click();
    const dialog = window.getByRole('dialog');
    await dialog.getByText('Export', { exact: true }).first().click();
    await expect(dialog.getByText('Export as ZIP', { exact: true })).toBeVisible();
    await shoot(window, 'user-guide/export-tab', theme);
  });
}

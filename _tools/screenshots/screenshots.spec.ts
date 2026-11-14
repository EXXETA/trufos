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
const { clickMenuItem, openAppSettings, stubDirectoryPicker } = app('helpers/main-process');
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

/** Opens a tab of the collection settings and returns the dialog. */
async function openCollectionSettings(window: any, tab: string) {
  await window.getByRole('button', { name: 'Collection settings' }).click();
  const dialog = window.getByRole('dialog');
  await dialog.getByText(tab, { exact: true }).first().click();
  return dialog;
}

/** Adds a variable as the last row of the variable table in the dialog. */
async function addVariable(
  dialog: any,
  { key, value, description, secret }: { key: string; value: string; description?: string; secret?: boolean }
) {
  await dialog.getByRole('button', { name: 'Add Variable' }).click();
  await dialog.getByPlaceholder('Enter variable key').last().fill(key);
  await dialog.getByPlaceholder('Enter variable value').last().fill(value);
  if (description != null) await dialog.getByPlaceholder('Enter variable description').last().fill(description);
  if (secret) await dialog.getByRole('checkbox', { name: 'Secret' }).last().click();
}

/** Makes an environment of the Bookshop collection the active one. */
async function selectEnvironment(window: any, name: string) {
  const dialog = await openCollectionSettings(window, 'Environments');
  await dialog.getByText(name, { exact: true }).first().click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
}

/**
 * Replaces the content of the Monaco editor in the given container. The text is pasted, as typed
 * text is indented like the line before it.
 */
async function setEditorText(trufos: any, container: any, text: string) {
  const { window } = trufos;
  await trufos.app.evaluate(({ clipboard }: any, text: string) => clipboard.writeText(text), text);
  await container.locator('.monaco-editor').first().click();
  await window.keyboard.press('ControlOrMeta+A');
  await window.keyboard.press('ControlOrMeta+V');
}

// short lines: the script editor is narrow in the screenshots
const PRE_REQUEST_SCRIPT = `// count how often the request is sent
const count = Number(
  trufos.getCollectionVariable('count') ?? 0
) + 1;
trufos.setCollectionVariable(
  'count', String(count)
);
console.log('Sending request', count);

// undefined while no environment is selected
const baseUrl =
  trufos.getEnvironmentVariable('baseUrl');
if (baseUrl == null) {
  console.warn('No environment selected');
}
`;

/** Scrolls the scrollable container of an element back to its top. */
async function scrollToTop(locator: any) {
  await locator.evaluate((element: HTMLElement) => {
    for (let node: HTMLElement | null = element; node != null; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight + 1 && getComputedStyle(node).overflowY !== 'visible') {
        node.scrollTop = 0;
        return;
      }
    }
  });
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

  test(`variables-autocomplete ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await importBookshop(trufos);
    await openFolder(window, 'Books', 'List books');
    await selectRequest(window, 'Get a book');
    const url = window.locator('.monaco-editor').first();
    await url.locator('.view-line').click();
    await window.keyboard.press('End');
    await window.keyboard.type('?author={{');
    await expect(window.locator('.suggest-widget')).toBeVisible();
    await expect(window.locator('.suggest-widget')).toContainText('baseUrl');
    await shoot(window, 'user-guide/variables-autocomplete', theme, CONTENT_SIZE, async () => {});
  });

  test(`variables-hover ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await importBookshop(trufos);
    await selectEnvironment(window, 'Staging');
    await openFolder(window, 'Books', 'List books');
    await selectRequest(window, 'List books');
    await shoot(window, 'user-guide/variables-hover', theme, CONTENT_SIZE, async () => {
      const url = window.locator('.monaco-editor').first();
      await url.locator('.view-line').getByText('baseUrl').first().hover();
      await expect(window.locator('.monaco-hover').filter({ hasText: 'Current value' })).toBeVisible();
    });
  });

  test(`variables-collection-tab ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await importBookshop(trufos);
    const dialog = await openCollectionSettings(window, 'Variables');
    await addVariable(dialog, { key: 'apiKey', value: 'sk-live-2f9c1d7e', description: 'Key of the bookshop API', secret: true });
    await dialog.getByText('Variables', { exact: true }).first().click();
    await scrollToTop(dialog.getByRole('button', { name: 'Add Variable' }));
    await shoot(window, 'user-guide/variables-collection-tab', theme);
  });

  test(`variables-environments-tab ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await importBookshop(trufos);
    const dialog = await openCollectionSettings(window, 'Environments');
    await dialog.getByText('Staging', { exact: true }).first().click();
    await addVariable(dialog, { key: 'userId', value: '7', description: 'Test user on staging' });
    await dialog.getByRole('heading', { name: 'Environments' }).click();
    await shoot(window, 'user-guide/variables-environments-tab', theme);
  });

  test(`requests-headers-tab ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await importBookshop(trufos);
    await openFolder(window, 'Books', 'List books');
    await selectRequest(window, 'Create a book');
    await window.getByRole('tab', { name: /^Headers/ }).first().click();
    await window.getByRole('button', { name: 'Add Header' }).click();
    await window.getByPlaceholder('Enter header key').last().fill('Accept');
    await window.getByPlaceholder('Enter header value').last().fill('application/json');
    // closes the suggestions of the input
    await window.keyboard.press('Escape');
    await window.locator('body').click({ position: { x: CONTENT_SIZE.width - 4, y: CONTENT_SIZE.height - 4 } });
    await shoot(window, 'user-guide/requests-headers-tab', theme);
  });

  test(`scripting-tab ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await importBookshop(trufos);
    await openFolder(window, 'Books', 'List books');
    await selectRequest(window, 'List books');
    await window.getByRole('tab', { name: 'Scripts', exact: true }).click();
    const panel = window.getByRole('tabpanel', { name: 'Scripts' });
    await setEditorText(trufos, panel, PRE_REQUEST_SCRIPT);
    await shoot(window, 'user-guide/scripting-tab', theme);
  });

  test(`scripting-history-console ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await selectRequest(window, 'Example Request');
    // answers with a fixed JSON document, unlike the default echo service, which adds the IP address
    await setUrl(window, 'https://jsonplaceholder.typicode.com/todos/1');
    await window.getByRole('tab', { name: 'Scripts', exact: true }).click();
    const panel = window.getByRole('tabpanel', { name: 'Scripts' });
    await setEditorText(trufos, panel, PRE_REQUEST_SCRIPT);
    await panel.getByRole('combobox').click();
    await window.getByRole('option', { name: 'Post-Response', exact: true }).click();
    await setEditorText(
      trufos,
      panel,
      "console.info('Response received, count is', trufos.getCollectionVariable('count'));\n"
    );
    for (let i = 0; i < 2; i++) {
      await sendRequest(window);
      await expect(responseStatus(window)).toContainText('200');
    }
    await window.getByRole('button', { name: 'Request history' }).click();
    const entry = window.getByRole('list', { name: 'Request history' }).getByRole('button');
    await expect(entry).toHaveCount(2);
    await entry.first().click();
    const details = window.getByRole('region', { name: 'History entry' });
    await details.getByRole('tab', { name: /^Console/ }).click();
    await expect(details.getByRole('list', { name: 'Console' })).toContainText('Sending request');
    await shoot(window, 'user-guide/scripting-history-console', theme);
  });

  test(`collection-runner ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await clickMenuItem(trufos.app, 'Run Collection');
    const run = window.getByRole('button', { name: /^Run \d+ request/ });
    await run.click();
    await expect(window.getByText('Passed')).toHaveCount(2, { timeout: 30_000 });
    await shoot(window, 'user-guide/collection-runner', theme);
  });

  test(`command-palette ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await importBookshop(trufos);
    await openFolder(window, 'Books', 'List books');
    await window.keyboard.press('ControlOrMeta+K');
    await window.getByPlaceholder('Search...').fill('book');
    await shoot(window, 'user-guide/command-palette', theme);
  });

  test(`settings-mcp ${theme}`, async ({ trufos }: any) => {
    const { window } = trufos;
    await prepare(trufos, theme);
    await openAppSettings(trufos.app);
    const dialog = window.getByRole('dialog');
    await dialog.getByText('MCP Server', { exact: true }).first().click();
    await dialog.getByRole('checkbox', { name: 'Enable MCP server' }).click();
    await expect(dialog.getByText('Running', { exact: true })).toBeVisible();
    await shoot(window, 'user-guide/settings-mcp', theme);
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

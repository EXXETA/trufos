import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  _electron as electron,
  ElectronApplication,
  expect,
  Page,
  test as base,
  TestInfo,
} from '@playwright/test';
import { AppUnderTest, resolveAppUnderTest } from './app-under-test';
import { EchoServer, startEchoServer } from './echo-server';

export { expect } from '@playwright/test';

/** A launched Trufos instance together with its main window. */
export interface TrufosApp {
  readonly app: ElectronApplication;
  readonly window: Page;

  /** Everything the main process wrote to stdout and stderr since launch. */
  readonly logs: string[];

  /** Quits the application through its regular close handshake. */
  close(): Promise<void>;
}

export interface LaunchOptions {
  /** Extra command line switches to append. */
  args?: string[];
}

interface TrufosFixtures {
  /**
   * The temporary `userData` directory shared by every instance launched within a test. Because
   * the app derives `settings.json`, the default collection and its logs from it, pointing it at a
   * fresh directory isolates the whole test.
   */
  userDataDir: string;

  /** Launches another instance against {@link userDataDir}, e.g. to assert persistence. */
  launchTrufos: (options?: LaunchOptions) => Promise<TrufosApp>;

  /** The instance every test starts with. */
  trufos: TrufosApp;
}

interface TrufosWorkerFixtures {
  appUnderTest: AppUnderTest;
  echoServer: EchoServer;
}

/** How long a single application launch may take before it is reported as a failure. */
const LAUNCH_TIMEOUT_MS = 30_000;

/**
 * Chromium's SUID sandbox helper needs privileges that CI containers usually do not grant, which
 * makes Electron abort before the first window opens. Local runs keep the sandbox on so they stay
 * faithful to what a user gets.
 */
function sandboxArgs(): string[] {
  return process.env.CI && process.platform === 'linux' ? ['--no-sandbox'] : [];
}

/**
 * Keeps the app's encrypted storage away from the real OS keyring.
 *
 * `main.ts` aborts when `safeStorage.isEncryptionAvailable()` returns false, so these flags have to
 * make encryption available rather than switch it off. On macOS a real Keychain lookup blocks on a
 * modal authorization prompt that no automated run can answer — the process stays alive and never
 * reaches `new BrowserWindow`. On Linux a headless runner has no keyring to talk to at all.
 */
function keyringArgs(): string[] {
  return process.platform === 'darwin' ? ['--use-mock-keychain'] : ['--password-store=basic'];
}

async function launchApp(
  appUnderTest: AppUnderTest,
  userDataDir: string,
  testInfo: TestInfo,
  options: LaunchOptions,
  register: (instance: TrufosApp) => void
): Promise<TrufosApp> {
  const app = await electron.launch({
    executablePath: appUnderTest.executablePath,
    args: [
      appUnderTest.entry,
      // Relocates everything the app persists into the test's temporary directory.
      `--user-data-dir=${userDataDir}`,
      ...keyringArgs(),
      ...sandboxArgs(),
      ...(options.args ?? []),
    ],
    // Without this the launch inherits the whole test budget. Playwright attaches to the main
    // process through the Node inspector, and anything that stops the app from reaching that point
    // — a modal error dialog, a blocked keyring — hangs here with no output of its own, so failing
    // fast and reporting it as a launch failure beats a bare test timeout.
    timeout: LAUNCH_TIMEOUT_MS,
  });

  // Attached before anything is awaited: when startup stalls, the main process log is the only
  // account of why, and every later step needs it to already be collecting.
  const logs: string[] = [];
  app.process().stdout?.on('data', (chunk) => logs.push(String(chunk)));
  app.process().stderr?.on('data', (chunk) => logs.push(String(chunk)));

  await app.context().tracing.start({ screenshots: true, snapshots: true, title: testInfo.title });

  // A window that never appears means the main process stopped before creating one — and because
  // `main.ts` reports startup failures through the blocking `dialog.showErrorBox`, it then hangs
  // rather than exiting. Its own log is the only account of what went wrong, so it is carried into
  // the error: nothing is registered for teardown to collect yet at this point.
  let window: Page;
  try {
    window = await app.firstWindow({ timeout: LAUNCH_TIMEOUT_MS });
  } catch (error) {
    throw new Error(
      `Trufos never opened a window within ${LAUNCH_TIMEOUT_MS} ms.\n` +
        `Main process log:\n${logs.join('') || '<no output>'}`,
      { cause: error }
    );
  }

  const instance: TrufosApp = { app, window, logs, close: () => app.close() };

  // Registered before the readiness check so that a window which never finishes rendering still
  // gets its trace and screenshot collected during teardown.
  register(instance);

  // No `waitForLoadState()` here: the lifecycle events of the first document can already have been
  // dispatched by the time Playwright attaches to the window, in which case it waits for an event
  // that will never come again. Locator assertions auto-wait and do not depend on load state.
  //
  // The main process only shows the window once the renderer reports itself ready, so waiting for
  // a control the sidebar always renders is both a "rendered" and a "visible" signal.
  try {
    await expect(window.getByRole('button', { name: 'Add new request' })).toBeVisible();
  } catch (error) {
    const url = window.url();
    const title = await window.title().catch(() => '<unavailable>');
    throw new Error(`Trufos did not finish rendering (window url: ${url}, title: ${title})`, {
      cause: error,
    });
  }

  return instance;
}

/**
 * Stops tracing, keeping the trace only when the test failed. A passing test would otherwise
 * leave tens of megabytes behind per run.
 */
async function collectDiagnostics(
  instance: TrufosApp,
  testInfo: TestInfo,
  index: number
): Promise<void> {
  const failed = testInfo.status !== testInfo.expectedStatus;

  if (failed && instance.logs.length > 0) {
    await testInfo.attach(`main-process-log-${index}`, {
      body: instance.logs.join(''),
      contentType: 'text/plain',
    });
  }

  if (failed) {
    const screenshot = testInfo.outputPath(`failure-${index}.png`);
    await attachIfWritten(testInfo, `screenshot-${index}`, 'image/png', screenshot, () =>
      instance.window.screenshot({ path: screenshot })
    );
  }

  const trace = testInfo.outputPath(`trace-${index}.zip`);
  await attachIfWritten(testInfo, `trace-${index}`, 'application/zip', trace, () =>
    instance.app.context().tracing.stop(failed ? { path: trace } : {})
  );
}

/**
 * Runs a diagnostic capture and attaches its file only if one was actually produced.
 *
 * A window that never loaded cannot be screenshotted, and attaching a path that does not exist
 * fails with `ENOENT` — replacing the real failure with a confusing one from the teardown.
 */
async function attachIfWritten(
  testInfo: TestInfo,
  name: string,
  contentType: string,
  filePath: string,
  capture: () => Promise<unknown>
): Promise<void> {
  try {
    await capture();
    await access(filePath);
  } catch {
    return;
  }
  await testInfo.attach(name, { path: filePath, contentType });
}

export const test = base.extend<TrufosFixtures, TrufosWorkerFixtures>({
  appUnderTest: [
    async ({}, use) => {
      await use(await resolveAppUnderTest());
    },
    { scope: 'worker' },
  ],

  echoServer: [
    async ({}, use) => {
      const server = await startEchoServer();
      await use(server);
      await server.close();
    },
    { scope: 'worker' },
  ],

  userDataDir: async ({}, use) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'trufos-e2e-'));
    await use(dir);
    await rm(dir, { recursive: true, force: true });
  },

  launchTrufos: async ({ appUnderTest, userDataDir }, use, testInfo) => {
    const instances: TrufosApp[] = [];

    await use((options = {}) =>
      launchApp(appUnderTest, userDataDir, testInfo, options, (instance) =>
        instances.push(instance)
      )
    );

    for (const [index, instance] of instances.entries()) {
      await collectDiagnostics(instance, testInfo, index);
      await instance.close().catch(() => undefined);
    }
  },

  trufos: async ({ launchTrufos }, use) => {
    await use(await launchTrufos());
  },
});

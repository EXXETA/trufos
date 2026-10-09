import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..');

const ELECTRON_MODULE = path.join(REPOSITORY_ROOT, 'node_modules', 'electron');

/** The fields of `package.json` this suite relies on. */
const PackageManifest = z.object({ main: z.string() });

export interface AppUnderTest {
  /** The Electron binary to spawn. */
  executablePath: string;

  /** The application directory to load, i.e. the repository root. */
  entry: string;
}

/**
 * Resolves the Electron application the end-to-end suite runs.
 *
 * The suite drives the built bundles from `.vite/` through Electron directly rather than the
 * packaged app in `out/`. Playwright attaches to the main process through the Node inspector: it
 * spawns Electron with `--inspect=0` and waits for the `Debugger listening on ws://…` line. The
 * packaged app disables the `EnableNodeCliInspectArguments` fuse (see `forge.config.ts`), which
 * strips that flag, so `electron.launch()` would wait forever. Asar packaging and the fuses
 * themselves are therefore out of scope here and stay covered by manual release checks.
 *
 * The bundles are the real production ones, so the main process, preload and renderer under test
 * are exactly what gets packaged.
 *
 * @throws if the bundles have not been built yet.
 */
export async function resolveAppUnderTest(): Promise<AppUnderTest> {
  const mainBundle = path.join(REPOSITORY_ROOT, await readMainEntry());

  try {
    await access(mainBundle);
  } catch {
    throw new Error(
      `No main process bundle at ${mainBundle}. Run \`yarn package\` before the e2e suite.`
    );
  }

  await assertProductionBundle(mainBundle);

  return { executablePath: await resolveElectronBinary(), entry: REPOSITORY_ROOT };
}

/**
 * Rejects a main bundle that was built in development mode.
 *
 * `yarn start` rebuilds `.vite/build` with the Vite dev-server URL compiled in, and an app
 * launched from that bundle dies with `ERR_CONNECTION_REFUSED` once the dev server is gone —
 * behind a modal error dialog, so the suite would only see an app that never becomes ready.
 *
 * The marker is the compiled-in dev-server `loadURL` call; the production build eliminates that
 * branch entirely. If the bundler ever changes the emitted shape, the check fails open and the
 * launch surfaces the connection error instead.
 */
async function assertProductionBundle(mainBundle: string): Promise<void> {
  const bundle = await readFile(mainBundle, 'utf8');
  if (bundle.includes('loadURL("http://localhost:')) {
    throw new Error(
      `${mainBundle} is a development build left behind by \`yarn start\` — it loads the renderer ` +
        'from the Vite dev server instead of the built files. Run `yarn package` to rebuild it.'
    );
  }
}

/**
 * Reads the main entry point from `package.json` rather than hardcoding it. Electron Forge decides
 * the bundle's name and extension, and has changed it between major versions.
 */
async function readMainEntry(): Promise<string> {
  const manifestPath = path.join(REPOSITORY_ROOT, 'package.json');
  return PackageManifest.parse(JSON.parse(await readFile(manifestPath, 'utf8'))).main;
}

/**
 * The executable inside `node_modules/electron/dist`, mirroring the mapping in electron's own
 * `install.js`.
 *
 * That script records the same value in a `path.txt` next to the dist directory, but only as a
 * side effect of downloading: a checkout whose postinstall did not run has neither file. Deriving
 * the name instead keeps this dependent on the binary alone.
 */
function electronExecutableName(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join('Electron.app', 'Contents', 'MacOS', 'Electron');
    case 'win32':
      return 'electron.exe';
    default:
      return 'electron';
  }
}

async function resolveElectronBinary(): Promise<string> {
  const executable = path.join(ELECTRON_MODULE, 'dist', electronExecutableName());

  try {
    await access(executable);
  } catch {
    throw new Error(
      `Electron binary not found at ${executable}. Its postinstall step did not run — ` +
        'run `node node_modules/electron/install.js` to fetch it.'
    );
  }

  return executable;
}

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

/**
 * Fingerprint of the sources the app bundles are built from. `yarn package` records it, and the
 * end-to-end suite compares it to the current sources to refuse running against outdated bundles.
 */

/**
 * Everything that ends up in, or changes, the bundles in `.vite/build`. Tooling outside `src` that
 * affects the bundles, such as a Vite plugin, has to be listed here explicitly.
 */
const BUNDLE_INPUTS = [
  'src',
  'plugins',
  'index.html',
  'package.json',
  'yarn.lock',
  'forge.config.ts',
  'forge.env.d.ts',
  'tsconfig.base.json',
  'tools/vite-plugin-monaco.mts',
];

/** Inputs that never end up in a bundle, so changing them must not mark the bundles outdated. */
const NOT_BUNDLED =
  /(\.test\.tsx?$|(^|\/)__mocks__\/|(^|\/)__fixtures__\/|(^|\/)test-setup\.ts$|(^|\/)vitest\.config\.mts$)/;

/**
 * Kept outside of `.vite/`: Forge packages that directory into the app. `node_modules/.cache` is
 * the conventional, ignored place for tool caches.
 */
const FINGERPRINT_FILE = path.join('node_modules', '.cache', 'trufos', 'package-fingerprint.json');

const FingerprintFile = z.object({ fingerprint: z.string() });

/**
 * Hashes the contents of all bundle inputs. Files are listed through git, so ignored and
 * generated files are skipped while new, not yet committed files count.
 * @param root the repository root
 * @returns a hex digest that changes whenever a bundle input is added, removed or modified
 */
export function computeSourceFingerprint(root: string): string {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...BUNDLE_INPUTS],
    { cwd: root, encoding: 'utf8' }
  )
    .split('\0')
    .filter((file) => file !== '' && !NOT_BUNDLED.test(file))
    // tracked files deleted from the working tree are still listed
    .filter((file) => existsSync(path.join(root, file)));

  const hash = createHash('sha256');
  for (const file of [...new Set(files)].sort()) {
    hash.update(file).update('\0');
    hash.update(
      createHash('sha256')
        .update(readFileSync(path.join(root, file)))
        .digest()
    );
  }
  return hash.digest('hex');
}

/**
 * Records the fingerprint of the sources the current bundles were built from.
 * @param root the repository root
 * @param fingerprint the fingerprint computed before the bundles were built
 */
export async function writeSourceFingerprint(root: string, fingerprint: string): Promise<void> {
  const file = path.join(root, FINGERPRINT_FILE);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(FingerprintFile.parse({ fingerprint })));
}

/**
 * Reads the fingerprint recorded by the last `yarn package`.
 * @param root the repository root
 * @returns the fingerprint, or `undefined` if none was recorded
 */
export async function readSourceFingerprint(root: string): Promise<string | undefined> {
  try {
    const content = await readFile(path.join(root, FINGERPRINT_FILE), 'utf8');
    return FingerprintFile.parse(JSON.parse(content)).fingerprint;
  } catch {
    return undefined;
  }
}

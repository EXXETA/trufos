import { MakerBase, type MakerOptions } from '@electron-forge/maker-base';
import type { ForgeArch, ForgePlatform } from '@electron-forge/shared-types';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Name of the user remote that the runtime, SDK and base app are installed from. */
const FLATHUB_REMOTE = 'flathub';

const FLATHUB_REPO_URL = 'https://dl.flathub.org/repo/flathub.flatpakrepo';

/** Flatpak architecture names of the Forge architectures that Flathub provides runtimes for. */
const FLATPAK_ARCHES: Partial<Record<ForgeArch, string>> = {
  x64: 'x86_64',
  arm64: 'aarch64',
};

/** Icons named after their size, e.g. `512x512.png`, which is also their hicolor directory. */
const ICON_FILE = /^(\d+x\d+)\.png$/;

export interface MakerFlatpakConfig {
  /** Reverse-DNS application ID, also the base name of the files in {@link dataDir}. */
  id: string;
  /** Branch of `org.freedesktop.Platform` and `org.electronjs.Electron2.BaseApp`. */
  runtimeVersion: string;
  /** Sandbox permissions of the app. */
  finishArgs: string[];
  /** Directory containing `<id>.desktop` and `<id>.metainfo.xml`. */
  dataDir: string;
  /** Directory containing the app icons as `<size>x<size>.png`. */
  iconDir: string;
}

/** The subset of the flatpak-builder manifest format that this maker uses. */
interface FlatpakManifest {
  id: string;
  runtime: string;
  'runtime-version': string;
  sdk: string;
  base: string;
  'base-version': string;
  command: string;
  'finish-args': string[];
  modules: {
    name: string;
    buildsystem: 'simple';
    sources: FlatpakSource[];
    'build-commands': string[];
  }[];
}

type FlatpakSource =
  | { type: 'dir'; path: string; dest: string }
  | { type: 'script'; 'dest-filename': string; commands: string[] };

/**
 * Builds a single-file Flatpak bundle from the packaged app.
 *
 * `@electron-forge/maker-flatpak` is not used on purpose: it depends on an installer that has not
 * been released since 2021 and pins a zypak version that no longer builds with the current
 * freedesktop SDK (electron/forge#4240). Instead, the packaged app is copied into a Flatpak on top
 * of the Electron base app from Flathub, which already ships zypak.
 */
export class MakerFlatpak extends MakerBase<MakerFlatpakConfig> {
  name = 'flatpak';

  defaultPlatforms: ForgePlatform[] = ['linux'];

  requiredExternalBinaries = ['flatpak', 'flatpak-builder'];

  isSupportedOnCurrentPlatform(): boolean {
    return process.platform === 'linux';
  }

  async make({
    dir,
    makeDir,
    appName,
    forgeConfig,
    packageJSON,
    targetArch,
  }: MakerOptions): Promise<string[]> {
    const arch = FLATPAK_ARCHES[targetArch];
    if (arch == null) throw new Error(`Flatpak does not support the architecture ${targetArch}`);
    const version: unknown = packageJSON.version;
    if (typeof version !== 'string') throw new Error('package.json has no version');

    // the packager's own default for the name of the executable
    const executableName = forgeConfig.packagerConfig.executableName ?? appName;
    const workDir = path.resolve(makeDir, 'flatpak', 'linux', targetArch);
    const manifestPath = path.join(workDir, `${this.config.id}.json`);
    const repoDir = path.join(workDir, 'repo');
    const bundlePath = path.join(workDir, `${appName}-${version}-${arch}.flatpak`);

    await this.ensureDirectory(workDir);
    const manifest = this.manifest(dir, executableName, await this.iconSizes());
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    await run('flatpak', [
      'remote-add',
      '--user',
      '--if-not-exists',
      FLATHUB_REMOTE,
      FLATHUB_REPO_URL,
    ]);
    await run('flatpak-builder', [
      '--user',
      `--install-deps-from=${FLATHUB_REMOTE}`,
      '--force-clean',
      // FUSE is not available in containers and on CI runners
      '--disable-rofiles-fuse',
      `--arch=${arch}`,
      `--state-dir=${path.join(makeDir, 'flatpak', '.flatpak-builder')}`,
      `--repo=${repoDir}`,
      path.join(workDir, 'build'),
      manifestPath,
    ]);
    await run('flatpak', [
      'build-bundle',
      `--arch=${arch}`,
      `--runtime-repo=${FLATHUB_REPO_URL}`,
      repoDir,
      bundlePath,
      this.config.id,
    ]);
    return [bundlePath];
  }

  /** The sizes of the icons in the icon directory, e.g. `512x512`. */
  private async iconSizes(): Promise<string[]> {
    const files = await readdir(this.config.iconDir);
    return files.flatMap((file) => ICON_FILE.exec(file)?.[1] ?? []);
  }

  private manifest(appDir: string, executableName: string, iconSizes: string[]): FlatpakManifest {
    const { id, runtimeVersion, finishArgs } = this.config;
    return {
      id,
      runtime: 'org.freedesktop.Platform',
      'runtime-version': runtimeVersion,
      sdk: 'org.freedesktop.Sdk',
      base: 'org.electronjs.Electron2.BaseApp',
      'base-version': runtimeVersion,
      command: executableName,
      'finish-args': finishArgs,
      modules: [
        {
          name: executableName,
          buildsystem: 'simple',
          sources: [
            { type: 'dir', path: appDir, dest: 'app' },
            { type: 'dir', path: path.resolve(this.config.dataDir), dest: 'data' },
            { type: 'dir', path: path.resolve(this.config.iconDir), dest: 'icons' },
            {
              // zypak makes the Chromium sandbox work inside the Flatpak sandbox
              type: 'script',
              'dest-filename': 'launcher.sh',
              commands: [`exec zypak-wrapper /app/${executableName}/${executableName} "$@"`],
            },
          ],
          'build-commands': [
            `cp -a app /app/${executableName}`,
            `install -Dm755 launcher.sh /app/bin/${executableName}`,
            `install -Dm644 data/${id}.desktop -t /app/share/applications`,
            `install -Dm644 data/${id}.metainfo.xml -t /app/share/metainfo`,
            ...iconSizes.map(
              (size) =>
                `install -Dm644 icons/${size}.png /app/share/icons/hicolor/${size}/apps/${id}.png`
            ),
          ],
        },
      ],
    };
  }
}

/** Runs a command with its output passed through, so that build errors are visible. */
async function run(command: string, args: string[]): Promise<void> {
  const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  const [code]: (number | null)[] = await once(child, 'close');
  if (code !== 0) throw new Error(`${command} failed with exit code ${String(code)}`);
}

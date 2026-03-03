import type { ForgeConfig, ForgePackagerOptions } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

let osxNotarize: ForgePackagerOptions['osxNotarize'];
let osxSign: ForgePackagerOptions['osxSign'];
if (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER) {
  osxNotarize = {
    appleApiKey: process.env.APPLE_API_KEY,
    appleApiKeyId: process.env.APPLE_API_KEY_ID,
    appleApiIssuer: process.env.APPLE_API_ISSUER,
  };
  osxSign = true;
}

const config: ForgeConfig = {
  hooks: {
    generateAssets: async () => {
      const ts = (await import('typescript')).default;
      const { resolve } = await import('node:path');
      const { writeFile } = await import('node:fs/promises');

      const shimPath = resolve('src/shim/scripting.ts');
      const program = ts.createProgram([shimPath], { strict: true });
      const checker = program.getTypeChecker();
      const sourceFile = program.getSourceFile(shimPath);
      if (!sourceFile) throw new Error('scripting.ts not found');

      let typeStr = '';
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isInterfaceDeclaration(node) && node.name.text === 'GlobalScriptingApi') {
          const type = checker.getTypeAtLocation(node);
          const symbol = checker.getPropertyOfType(type, 'trufos');
          if (symbol) {
            const trufosType = checker.getTypeOfSymbolAtLocation(symbol, node);
            typeStr = checker.typeToString(trufosType, undefined, ts.TypeFormatFlags.NoTruncation);
          }
        }
      });

      if (!typeStr) throw new Error('Could not resolve trufos type in GlobalScriptingApi');
      const out = `// Auto-generated from src/shim/scripting.ts – do not edit manually\ndeclare const trufos: ${typeStr};\n`;
      await writeFile(resolve('src/renderer/assets/trufos-scripting-api.d.ts'), out);
      console.log('[generateAssets] Generated trufos-scripting-api.d.ts');
    },
  },
  packagerConfig: {
    asar: true,
    icon: './images/icon',
    osxSign,
    osxNotarize,
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['linux']), new MakerDMG()],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/main.ts',
          config: 'src/main/vite.config.ts',
          target: 'main',
        },
        {
          entry: 'src/main/preload.ts',
          config: 'src/main/vite.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'src/renderer/vite.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'EXXETA',
          name: 'trufos',
        },
        prerelease: true,
      },
    },
  ],
};

export default config;

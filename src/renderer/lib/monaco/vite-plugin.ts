import path from 'node:path';
import { readdirSync, existsSync, createReadStream, cpSync } from 'node:fs';
import type { ResolvedConfig } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

const VIRTUAL_MONACO_WORKERS = 'virtual:monaco-workers';
const RESOLVED_VIRTUAL_MONACO_WORKERS = '\0virtual:monaco-workers';

const MONACO_MIME: Record<string, string> = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function monacoAmdPlugin(): any {
  const monacoVsPath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'node_modules',
    'monaco-editor',
    'min',
    'vs'
  );
  const assets = readdirSync(path.join(monacoVsPath, 'assets'));
  const workers = {
    editor: assets.find((f) => f.startsWith('editor.worker')) ?? '',
    typescript: assets.find((f) => f.startsWith('ts.worker')) ?? '',
    json: assets.find((f) => f.startsWith('json.worker')) ?? '',
    css: assets.find((f) => f.startsWith('css.worker')) ?? '',
    html: assets.find((f) => f.startsWith('html.worker')) ?? '',
  };

  let config: ResolvedConfig;

  return {
    name: 'monaco-amd',
    config() {
      return {
        optimizeDeps: { exclude: ['monaco-editor'] },
        build: {
          rolldownOptions: {
            output: {
              // Split Monaco into its own chunk so the main bundle stays small enough
              // for Vite 8's 32-bit WASM import-analysis parser.
              codeSplitting: { groups: [{ name: 'monaco', test: /monaco-editor/ }] },
            },
          },
        },
      };
    },
    configResolved(c: ResolvedConfig) {
      config = c;
    },
    resolveId(id: string) {
      if (id === VIRTUAL_MONACO_WORKERS) return RESOLVED_VIRTUAL_MONACO_WORKERS;
    },
    load(id: string) {
      if (id === RESOLVED_VIRTUAL_MONACO_WORKERS)
        return `export default ${JSON.stringify(workers)};`;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configureServer(server: any) {
      server.middlewares.use(
        '/vs',
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const urlPath = (req.url ?? '/').replace(/[?#].*$/, '');
          const filePath = path.join(monacoVsPath, urlPath);
          if (!filePath.startsWith(monacoVsPath) || !existsSync(filePath)) {
            next();
            return;
          }
          res.setHeader(
            'Content-Type',
            MONACO_MIME[path.extname(filePath)] ?? 'application/octet-stream'
          );
          createReadStream(filePath).pipe(res);
        }
      );
    },
    closeBundle() {
      if (!config?.build.ssr) {
        cpSync(monacoVsPath, path.join(path.resolve(config.root, config.build.outDir), 'vs'), {
          recursive: true,
        });
      }
    },
  };
}

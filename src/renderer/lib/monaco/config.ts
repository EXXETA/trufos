import './language';
import './theme';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import workers from 'virtual:monaco-workers';

(self as Window & typeof globalThis & { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker(_: string, label: string): Worker {
    const getUrl = (): string => {
      switch (label) {
        case 'json':
          return `./vs/assets/${workers.json}`;
        case 'css':
        case 'scss':
        case 'less':
          return `./vs/assets/${workers.css}`;
        case 'html':
        case 'handlebars':
        case 'razor':
          return `./vs/assets/${workers.html}`;
        case 'typescript':
        case 'javascript':
          return `./vs/assets/${workers.typescript}`;
        default:
          return `./vs/assets/${workers.editor}`;
      }
    };
    return new Worker(getUrl());
  },
};

loader.config({ monaco });
loader.init().then(() => console.info('Monaco editor initialized'));

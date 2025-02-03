import './language';
import { loader } from '@monaco-editor/react';

import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
// eslint-disable-next-line import/default
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
// eslint-disable-next-line import/default
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
// eslint-disable-next-line import/default
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_, label) {
    switch (label) {
      case 'json':
        return new jsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker();
      case 'typescript':
      case 'javascript':
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

loader.config({ monaco });
loader.init().then(() => console.info('Monaco editor initialized'));

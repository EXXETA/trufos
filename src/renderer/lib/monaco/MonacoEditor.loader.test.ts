import { describe, expect, it, vi } from 'vitest';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import './MonacoEditor';

// the real monaco core cannot run under jsdom, so the bundled monaco is replaced by a stand-in
vi.mock('monaco-editor', () => ({ editor: {} }));
// they register languages and themes, which needs the real monaco core
vi.mock('./language', () => ({}));
vi.mock('./theme', () => ({}));

describe('MonacoEditor', () => {
  it('configures the loader with the bundled monaco when it is loaded', () => {
    // otherwise @monaco-editor/react loads another monaco version from a CDN, whose
    // editors cannot use the models created with the bundled one
    expect(loader.__getMonacoInstance()).toBe(monaco);
  });
});

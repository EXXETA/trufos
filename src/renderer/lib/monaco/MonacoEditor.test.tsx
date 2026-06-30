import { createElement } from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { editor } from 'monaco-editor';

/**
 * The real monaco-editor core cannot run under jsdom (it throws while building
 * its theme/CSS, since jsdom has no layout engine), so the unit suite cannot
 * mount the actual editor — a faithful end-to-end reproduction of the unmount
 * crash would need a browser/electron e2e test.
 *
 * What this test does cover, against the **real** `@monaco-editor/react`
 * dependency: it stubs only the monaco-core loader with a lightweight fake so
 * the real `<Editor>` component mounts and unmounts, and asserts that
 * `MonacoEditor` (a) drives that lifecycle without throwing and (b) enables
 * `keepCurrentModel`. The `keepCurrentModel` flag is the guard that stops the
 * library from disposing the shared model on unmount — disposing it is what
 * crashes the app on newer monaco-editor versions when switching from the
 * request body editor to a tab without an editor. Dropping the flag fails the
 * second assertion.
 */

function makeFakeModel(id: string) {
  return new Proxy({ uri: { toString: () => id }, dispose: () => {} } as Record<string, unknown>, {
    get: (target, prop) => (prop in target ? target[prop as string] : () => ({ dispose() {} })),
  });
}

function makeFakeEditor() {
  let model: unknown = makeFakeModel('default');
  return new Proxy(
    {
      getModel: () => model,
      setModel: (next: unknown) => {
        model = next;
      },
      dispose: () => {},
    } as Record<string, unknown>,
    { get: (target, prop) => (prop in target ? target[prop as string] : () => ({ dispose() {} })) }
  );
}

const fakeMonaco = {
  editor: new Proxy(
    { create: () => makeFakeEditor(), getModel: () => null } as Record<string, unknown>,
    { get: (target, prop) => (prop in target ? target[prop as string] : () => ({ dispose() {} })) }
  ),
  languages: new Proxy({}, { get: () => () => ({ dispose() {} }) }),
};

vi.mock('@monaco-editor/loader', () => ({
  default: {
    config: () => {},
    init: () => Promise.resolve(fakeMonaco),
    __getMonacoInstance: () => fakeMonaco,
  },
}));

vi.mock('@/contexts/ThemeContext', () => ({
  TrufosTheme: { Light: 'light', Dark: 'dark' },
  useTheme: () => ({ theme: 'light' }),
}));
vi.mock('monaco-editor', () => ({ editor: {} }));

// Use the real @monaco-editor/react, wrapping <Editor> only to capture the
// props MonacoEditor passes to it.
let lastEditorProps: Record<string, unknown> | undefined;
vi.mock('@monaco-editor/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@monaco-editor/react')>();
  return {
    ...actual,
    Editor: (props: Record<string, unknown>) => {
      lastEditorProps = props;
      return createElement(actual.Editor, props);
    },
  };
});

import MonacoEditor from './MonacoEditor';

describe('MonacoEditor', () => {
  it('mounts and unmounts the real @monaco-editor/react editor without throwing', async () => {
    const model = makeFakeModel('shared') as unknown as editor.ITextModel;

    const { unmount } = render(<MonacoEditor model={model} />);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(() => unmount()).not.toThrow();
  });

  it('keeps the shared model alive on unmount (keepCurrentModel)', async () => {
    const model = makeFakeModel('shared') as unknown as editor.ITextModel;

    const { unmount } = render(<MonacoEditor model={model} />);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The shared model is owned by the model registry, not the editor; the
    // wrapper must tell @monaco-editor/react not to dispose it on unmount.
    expect(lastEditorProps?.keepCurrentModel).toBe(true);

    unmount();
  });
});
